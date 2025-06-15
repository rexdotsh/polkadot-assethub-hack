import {
  mutation,
  query,
  internalMutation,
  internalAction,
} from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { getUserId } from './users';
import { nftMoveSchema } from './schema';
import { getFallbackMoves } from '../lib/battle-utils';

function generateNFTStats(collectionId: string, itemId: string, metadata: any) {
  // create a hash from collection, item, and metadata
  const metadataStr = metadata?.name || metadata?.description || '';
  const hash = `${metadataStr}${collectionId}${itemId}`;

  let hashValue = 0;
  for (let i = 0; i < hash.length; i++) {
    hashValue = hashValue * 31 + hash.charCodeAt(i);
  }

  const rand = (min: number, max: number, seed: number) => {
    const x = Math.sin(seed) * 10000;
    return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
  };

  const stats = {
    attack: rand(20, 80, hashValue + 1),
    defense: rand(20, 80, hashValue + 2),
    intelligence: rand(10, 60, hashValue + 3),
    luck: rand(5, 50, hashValue + 5),
    speed: rand(10, 70, hashValue + 6),
    strength: rand(20, 80, hashValue + 7),
    nftType: Math.abs(hashValue) % 3,
    maxHealth: 0,
    generatedAt: Date.now(),
  };

  // TODO: correct?
  stats.maxHealth = Math.floor(50 + stats.strength * 0.5 + stats.defense * 0.3);

  return stats;
}

export const getUserNFTs = query({
  args: {
    address: v.string(),
  },
  handler: async (ctx, { address }) => {
    const userId = await getUserId(ctx, address);
    if (!userId) return [];

    const nftItems = await ctx.db
      .query('nftItems')
      .withIndex('by_user', (q) => q.eq('userAddress', userId))
      .collect();

    const collections = new Map();
    for (const item of nftItems) {
      if (!collections.has(item.collectionId)) {
        const collection = await ctx.db
          .query('nftCollections')
          .withIndex('by_collection_id', (q) =>
            q.eq('collectionId', item.collectionId),
          )
          .first();

        if (collection) {
          collections.set(item.collectionId, collection);
        }
      }
    }

    return nftItems.map((item) => ({
      collection: item.collectionId,
      item: item.itemId,
      owner: item.owner,
      itemDetails: item.itemDetails,
      itemMetadata: item.itemMetadata,
      collectionMetadata: collections.get(item.collectionId)?.metadata || null,
      stats: item.stats,
      customMoves: item.customMoves,
      lastSynced: item.lastSynced,
    }));
  },
});

export const getUserCollections = query({
  args: {
    address: v.string(),
  },
  handler: async (ctx, { address }) => {
    const userId = await getUserId(ctx, address);
    if (!userId) return [];

    return ctx.db
      .query('nftCollections')
      .withIndex('by_user', (q) => q.eq('userAddress', userId))
      .collect();
  },
});

export const syncUserNFTs = mutation({
  args: {
    address: v.string(),
    nfts: v.array(
      v.object({
        collection: v.string(),
        item: v.string(),
        owner: v.string(),
        itemDetails: v.any(),
        itemMetadata: v.any(),
        collectionMetadata: v.any(),
      }),
    ),
  },
  handler: async (ctx, { address, nfts }) => {
    const userId = await getUserId(ctx, address);
    if (!userId) {
      throw new Error(`User with address ${address} not found`);
    }

    const now = Date.now();
    const collections = new Map();

    const existingNfts = await ctx.db
      .query('nftItems')
      .withIndex('by_user', (q) => q.eq('userAddress', userId))
      .collect();

    const assetHubNftIds = new Set(
      nfts.map((nft) => `${nft.collection}-${nft.item}`),
    );

    const nftsToDelete = existingNfts.filter(
      (nft) => !assetHubNftIds.has(`${nft.collectionId}-${nft.itemId}`),
    );

    for (const nft of nftsToDelete) {
      await ctx.db.delete(nft._id);
    }

    for (const nft of nfts) {
      if (!collections.has(nft.collection)) {
        collections.set(nft.collection, {
          collectionId: nft.collection,
          owner: nft.owner,
          userAddress: userId,
          details: {},
          metadata: nft.collectionMetadata,
          lastSynced: now,
        });
      }

      const existingNft = await ctx.db
        .query('nftItems')
        .withIndex('by_item', (q) =>
          q.eq('collectionId', nft.collection).eq('itemId', nft.item),
        )
        .first();

      const stats = generateNFTStats(
        nft.collection,
        nft.item,
        nft.itemMetadata,
      );

      if (existingNft) {
        // update existing NFT with fresh stats
        await ctx.db.patch(existingNft._id, {
          owner: nft.owner,
          itemDetails: nft.itemDetails,
          itemMetadata: nft.itemMetadata,
          stats,
          lastSynced: now,
        });

        // Schedule AI move generation for existing NFT if it doesn't have a custom move
        if (!existingNft.customMoves) {
          await ctx.scheduler.runAfter(0, internal.nft.generateAIMove, {
            nftType: stats.nftType,
            collectionId: nft.collection,
            itemId: nft.item,
            nftMetadata: nft.itemMetadata,
          });
        }
      } else {
        // create new NFT with stats
        await ctx.db.insert('nftItems', {
          collectionId: nft.collection,
          itemId: nft.item,
          owner: nft.owner,
          userAddress: userId,
          itemDetails: nft.itemDetails,
          itemMetadata: nft.itemMetadata,
          stats,
          lastSynced: now,
        });

        // Schedule AI move generation for new NFT
        await ctx.scheduler.runAfter(0, internal.nft.generateAIMove, {
          nftType: stats.nftType,
          collectionId: nft.collection,
          itemId: nft.item,
          nftMetadata: nft.itemMetadata,
        });
      }
    }

    const collectionsWithNfts = new Set(nfts.map((nft) => nft.collection));
    const existingCollections = await ctx.db
      .query('nftCollections')
      .withIndex('by_user', (q) => q.eq('userAddress', userId))
      .collect();

    for (const collection of existingCollections) {
      if (!collectionsWithNfts.has(collection.collectionId)) {
        await ctx.db.delete(collection._id);
      }
    }

    for (const [collectionId, collectionData] of collections.entries()) {
      const existingCollection = await ctx.db
        .query('nftCollections')
        .withIndex('by_collection_id', (q) =>
          q.eq('collectionId', collectionId),
        )
        .first();

      if (existingCollection) {
        await ctx.db.patch(existingCollection._id, {
          metadata: collectionData.metadata,
          lastSynced: now,
        });
      } else {
        await ctx.db.insert('nftCollections', collectionData);
      }
    }

    return {
      success: true,
      syncedAt: now,
      nftCount: nfts.length,
      deletedCount: nftsToDelete.length,
    };
  },
});

export const syncUserCollections = mutation({
  args: {
    address: v.string(),
    collections: v.array(
      v.object({
        id: v.string(),
        owner: v.string(),
        details: v.any(),
        metadata: v.any(),
      }),
    ),
  },
  handler: async (ctx, { address, collections }) => {
    const userId = await getUserId(ctx, address);
    if (!userId) {
      throw new Error(`User with address ${address} not found`);
    }

    const now = Date.now();

    for (const collection of collections) {
      const existingCollection = await ctx.db
        .query('nftCollections')
        .withIndex('by_collection_id', (q) =>
          q.eq('collectionId', collection.id),
        )
        .first();

      if (existingCollection) {
        await ctx.db.patch(existingCollection._id, {
          owner: collection.owner,
          details: collection.details,
          metadata: collection.metadata,
          lastSynced: now,
        });
      } else {
        await ctx.db.insert('nftCollections', {
          collectionId: collection.id,
          owner: collection.owner,
          userAddress: userId,
          details: collection.details,
          metadata: collection.metadata,
          lastSynced: now,
        });
      }
    }

    return {
      success: true,
      syncedAt: now,
      collectionCount: collections.length,
    };
  },
});

export const getLastSyncTime = query({
  args: {
    address: v.string(),
  },
  handler: async (ctx, { address }) => {
    const userId = await getUserId(ctx, address);
    if (!userId) return null;

    const latestNft = await ctx.db
      .query('nftItems')
      .withIndex('by_user', (q) => q.eq('userAddress', userId))
      .order('desc')
      .first();

    const latestCollection = await ctx.db
      .query('nftCollections')
      .withIndex('by_user', (q) => q.eq('userAddress', userId))
      .order('desc')
      .first();

    const nftTime = latestNft?.lastSynced || 0;
    const collectionTime = latestCollection?.lastSynced || 0;

    return Math.max(nftTime, collectionTime) || null;
  },
});

export const getNFTMetadata = query({
  args: {
    collection: v.string(),
    item: v.string(),
  },
  handler: async (ctx, { collection, item }) => {
    const nftItem = await ctx.db
      .query('nftItems')
      .withIndex('by_item', (q) =>
        q.eq('collectionId', collection).eq('itemId', item),
      )
      .first();

    if (!nftItem) return null;

    return {
      itemMetadata: nftItem.itemMetadata,
      itemDetails: nftItem.itemDetails,
    };
  },
});

// AI Move Generation Action
export const generateAIMove = internalAction({
  args: {
    nftType: v.number(),
    collectionId: v.string(),
    itemId: v.string(),
    nftMetadata: v.any(),
  },
  handler: async (ctx, args) => {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const moves = await generateMovesWithAI(args);

        if (moves.length === 4) {
          // save the generated moves to the NFT
          await ctx.runMutation(internal.nft.saveGeneratedMoves, {
            collectionId: args.collectionId,
            itemId: args.itemId,
            customMoves: moves,
          });
          return moves;
        } else {
          throw new Error(`Expected 4 moves, got ${moves.length}`);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        console.error(`AI generation attempt ${attempt} failed:`, errorMessage);

        if (attempt === maxRetries) {
          // use fallback moves after all retries failed
          const fallbackMoves = getFallbackMoves(args.nftType);
          await ctx.runMutation(internal.nft.saveGeneratedMoves, {
            collectionId: args.collectionId,
            itemId: args.itemId,
            customMoves: fallbackMoves,
          });
          return fallbackMoves;
        }
      }
    }

    throw new Error('This should never be reached');
  },
});

async function generateMovesWithAI(args: {
  nftType: number;
  nftMetadata: any;
}) {
  const { createOpenRouter } = await import('@openrouter/ai-sdk-provider');
  const { generateText } = await import('ai');

  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const typeNames = ['Fire', 'Water', 'Grass'];
  const typeName = typeNames[args.nftType] || 'Unknown';
  const nftName = args.nftMetadata?.name || `${typeName} NFT`;
  const nftDescription = args.nftMetadata?.description || '';

  const systemPrompt = `<task>
Generate exactly 4 unique battle moves for this ${typeName} type NFT.
</task>

<nft_info>
<name>${nftName}</name>
<description>${nftDescription}</description>
<type>${typeName}</type>
</nft_info>

<requirements>
<move_count>Exactly 4 different moves</move_count>
<naming>Move names: 2 words each, ${typeName}-themed</naming>
<descriptions>15-20 words, describe battle effect</descriptions>
<icons>Use ONLY these icon names: Flame, Zap, Shield, Swords, Target, Brain, Heart, Eye, Wind, Leaf, Sun, Sparkles, Crown, Diamond, Star</icons>
<uniqueness>Make each move distinct from the others</uniqueness>
</requirements>

<output_format>
Return your response as valid JSON in this exact format:
{
  "moves": [
    {
      "name": "Move Name",
      "description": "Description of the move in 15-20 words",
      "iconName": "IconName"
    },
    {
      "name": "Move Name",
      "description": "Description of the move in 15-20 words", 
      "iconName": "IconName"
    },
    {
      "name": "Move Name",
      "description": "Description of the move in 15-20 words",
      "iconName": "IconName"
    },
    {
      "name": "Move Name", 
      "description": "Description of the move in 15-20 words",
      "iconName": "IconName"
    }
  ]
}
</output_format>`;

  const result = await generateText({
    model: openrouter.chat('anthropic/claude-4-sonnet-20250522'),
    prompt: systemPrompt,
    temperature: 0.8,
  });

  return parseMovesFromResponse(result.text.trim());
}

function parseMovesFromResponse(response: string) {
  try {
    // try to find JSON in the response - sometimes AI wraps it in markdown
    let jsonStr = response.trim();

    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonStr);

    if (!parsed.moves || !Array.isArray(parsed.moves)) {
      throw new Error('Response must contain a "moves" array');
    }

    if (parsed.moves.length !== 4) {
      throw new Error(`Expected 4 moves, got ${parsed.moves.length}`);
    }

    const moves = [];
    for (const move of parsed.moves) {
      if (!move.name || !move.description || !move.iconName) {
        throw new Error('Each move must have name, description, and iconName');
      }

      const moveName = move.name.trim();
      if (moveName.split(/\s+/).length !== 2) {
        throw new Error(`Move name must be 2 words: ${moveName}`);
      }

      moves.push({
        name: moveName,
        description: move.description.trim(),
        iconName: move.iconName.trim(),
      });
    }

    return moves;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON response: ${error.message}`);
    }
    throw error;
  }
}

// Internal mutation to save generated moves
export const saveGeneratedMoves = internalMutation({
  args: {
    collectionId: v.string(),
    itemId: v.string(),
    customMoves: v.array(nftMoveSchema),
  },
  handler: async (ctx, args) => {
    const nft = await ctx.db
      .query('nftItems')
      .withIndex('by_item', (q) =>
        q.eq('collectionId', args.collectionId).eq('itemId', args.itemId),
      )
      .first();

    if (nft) {
      await ctx.db.patch(nft._id, {
        customMoves: args.customMoves,
      });
    }
  },
});
