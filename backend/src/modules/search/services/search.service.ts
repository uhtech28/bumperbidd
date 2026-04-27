import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * SearchService — Postgres full-text + trigram search.
 * Uses ts_vector over (title, make, modelName, city) + pg_trgm for fuzzy match.
 * Required migration:
 *   CREATE EXTENSION IF NOT EXISTS pg_trgm;
 *   ALTER TABLE auctions ADD COLUMN search_tsv tsvector
 *     GENERATED ALWAYS AS (
 *       to_tsvector('simple',
 *         coalesce(title,'') || ' ' || coalesce(make,'') || ' ' ||
 *         coalesce(model_name,'') || ' ' || coalesce(city,''))
 *     ) STORED;
 *   CREATE INDEX idx_auctions_tsv ON auctions USING GIN(search_tsv);
 *   CREATE INDEX idx_auctions_trgm_title ON auctions USING GIN(title gin_trgm_ops);
 *   CREATE INDEX idx_auctions_trgm_make ON auctions USING GIN(make gin_trgm_ops);
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchAuctions(params: {
    q?: string;
    fuelType?: string;
    minPrice?: number;
    maxPrice?: number;
    yearFrom?: number;
    yearTo?: number;
    city?: string;
    status?: 'live' | 'scheduled' | 'ended';
    sort?: 'ending_soon' | 'newest' | 'price_asc' | 'price_desc';
    limit?: number;
    cursor?: string;
  }) {
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.fuelType) where.fuelType = params.fuelType;
    if (params.city) where.city = { contains: params.city, mode: 'insensitive' };
    if (params.yearFrom || params.yearTo) {
      where.year = {};
      if (params.yearFrom) where.year.gte = params.yearFrom;
      if (params.yearTo) where.year.lte = params.yearTo;
    }
    if (params.minPrice || params.maxPrice) {
      where.startingPrice = {};
      if (params.minPrice) where.startingPrice.gte = params.minPrice;
      if (params.maxPrice) where.startingPrice.lte = params.maxPrice;
    }
    if (params.q?.trim()) {
      const q = params.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { make: { contains: q, mode: 'insensitive' } },
        { modelName: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const limit = Math.min(Math.max(params.limit ?? 24, 1), 100);
    const orderBy: any = (() => {
      switch (params.sort) {
        case 'newest': return { createdAt: 'desc' };
        case 'price_asc': return { startingPrice: 'asc' };
        case 'price_desc': return { startingPrice: 'desc' };
        case 'ending_soon':
        default: return { endsAt: 'asc' };
      }
    })();

    const rows = await this.prisma.auction.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, -1) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /**
   * Fast fuzzy suggest for typeahead — uses pg_trgm similarity.
   */
  async suggest(q: string, limit = 8) {
    if (!q?.trim()) return [];
    const term = q.trim();
    const rows: Array<{ id: string; title: string; make: string; modelName: string; score: number }> =
      await this.prisma.$queryRawUnsafe(
        `SELECT id, title, make, model_name as "modelName",
                greatest(similarity(title, $1), similarity(make, $1), similarity(model_name, $1)) AS score
         FROM auctions
         WHERE title % $1 OR make % $1 OR model_name % $1
         ORDER BY score DESC
         LIMIT $2`,
        term, limit,
      );
    return rows;
  }
}
