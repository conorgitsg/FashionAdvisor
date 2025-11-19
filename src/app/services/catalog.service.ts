import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WardrobeTags {
  item_name?: string;
  broad_category?: string;
  sub_category?: string;
  silhouette?: string;
  materials?: string;
  colors?: string[];
  patterns?: string;
  construction_details?: string;
  style_vibe?: string;
  best_pairings?: string[];
  seasonality?: string[];
  tags?: string[];
}

export interface WardrobeItem {
  id: string;
  s3Key: string;
  imageUrl: string;
  tags: WardrobeTags;
  notes?: string;
  createdAt: string;
}

export interface ClothingItem {
  id: string;
  name: string;
  type: 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory';
  category: string;
  tags: string[];
  colors: string[];
  imageUrl: string;
  usageFrequency: number;
  dateAdded: Date;
  season?: string[];
  style?: string[];
}

export interface Outfit {
  id: string;
  name: string;
  items: ClothingItem[];
  tags: string[];
  category?: string;
  imageUrl: string;
  lastModified: Date;
  pieceCount: number;
}

export interface CatalogFilters {
  itemType: string[];
  colors: string[];
  styles: string[];
  seasons: string[];
  usage: string[];
  outfitTypes: string[];
}

export type SortOption = 'recent' | 'most-worn' | 'least-worn' | 'alphabetical';
export type ViewMode = 'clothing' | 'outfits' | 'all';

interface OutfitApiItem {
  id: string;
  name: string;
  type: ClothingItem['type'];
  category: string;
  tags: string[];
  colors: string[];
  imageUrl: string | null;
  usageFrequency: number;
  dateAdded: string;
  season: string[];
  style: string[];
}

interface OutfitApiResponse {
  id: string;
  name: string;
  tags: string[];
  notes?: string | null;
  imageUrl?: string | null;
  pieceCount: number;
  lastModified: string;
  items: OutfitApiItem[];
}

@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getWardrobeItems(): Observable<WardrobeItem[]> {
    return this.http.get<{ items: WardrobeItem[] }>(`${this.apiUrl}/wardrobe/items`).pipe(
      map(response => response.items),
      catchError(err => {
        console.error('Failed to fetch wardrobe items', err);
        return of([]);
      })
    );
  }

  getClothingItems(filters?: CatalogFilters, sort?: SortOption): Observable<ClothingItem[]> {
    return this.getWardrobeItems().pipe(
      map(items => this.transformAndFilterItems(items, filters, sort))
    );
  }

  getOutfits(filters?: CatalogFilters, sort?: SortOption): Observable<Outfit[]> {
    return this.http.get<{ outfits: OutfitApiResponse[] }>(`${this.apiUrl}/outfits`).pipe(
      map((response) => this.transformOutfits(response.outfits || [], filters, sort)),
      catchError(err => {
        console.error('Failed to fetch outfits', err);
        return of([]);
      })
    );
  }

  deleteItem(itemId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/wardrobe/items/${itemId}`);
  }

  deleteOutfit(outfitId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/outfits/${outfitId}`);
  }

  private transformAndFilterItems(wardrobeItems: WardrobeItem[], filters?: CatalogFilters, sort?: SortOption): ClothingItem[] {
    let items: ClothingItem[] = wardrobeItems.map(item => this.transformWardrobeItem(item));

    // Apply filters
    if (filters) {
      if (filters.itemType.length > 0) {
        items = items.filter(item => filters.itemType.includes(item.type));
      }
      if (filters.colors.length > 0) {
        items = items.filter(item =>
          item.colors.some(color => filters.colors.includes(color.toLowerCase()))
        );
      }
      if (filters.styles.length > 0) {
        items = items.filter(item =>
          item.style?.some(style => filters.styles.includes(style.toLowerCase()))
        );
      }
      if (filters.seasons.length > 0) {
        items = items.filter(item =>
          item.season?.some(season => filters.seasons.includes(season.toLowerCase()))
        );
      }
    }

    // Apply sorting
    if (sort) {
      switch (sort) {
        case 'recent':
          items.sort((a, b) => b.dateAdded.getTime() - a.dateAdded.getTime());
          break;
        case 'most-worn':
          items.sort((a, b) => b.usageFrequency - a.usageFrequency);
          break;
        case 'least-worn':
          items.sort((a, b) => a.usageFrequency - b.usageFrequency);
          break;
        case 'alphabetical':
          items.sort((a, b) => a.name.localeCompare(b.name));
          break;
      }
    }

    return items;
  }

  private transformWardrobeItem(item: WardrobeItem): ClothingItem {
    const tags = item.tags || {};

    // Map broad_category to type
    const typeMap: Record<string, ClothingItem['type']> = {
      'tops': 'top',
      'bottoms': 'bottom',
      'one-piece': 'dress',
      'outerwear': 'outerwear',
      'shoes': 'shoes',
      'accessories': 'accessory',
      'underwear/sleepwear': 'accessory',
      'sportswear/athleisure': 'top'
    };

    const broadCategory = (tags.broad_category || '').toLowerCase();
    const type = typeMap[broadCategory] || 'accessory';

    return {
      id: item.id,
      name: tags.item_name || 'Unnamed Item',
      type,
      category: tags.sub_category || tags.broad_category || 'Other',
      tags: tags.tags || [],
      colors: (tags.colors || []).map(c => c.toLowerCase()),
      imageUrl: item.imageUrl,
      usageFrequency: 0, // No usage tracking yet
      dateAdded: new Date(item.createdAt),
      season: (tags.seasonality || []).map(s => s.toLowerCase()),
      style: tags.style_vibe ? [tags.style_vibe.toLowerCase()] : []
    };
  }

  private getMockClothingItems(filters?: CatalogFilters, sort?: SortOption): ClothingItem[] {
    let items: ClothingItem[] = [
      {
        id: 'item-1',
        name: 'White Linen Blouse',
        type: 'top',
        category: 'Blouses',
        tags: ['casual', 'summer'],
        colors: ['white'],
        imageUrl: '/assets/placeholder-top.png',
        usageFrequency: 12,
        dateAdded: new Date('2024-01-15'),
        season: ['summer', 'all-season'],
        style: ['casual', 'minimalist']
      },
      {
        id: 'item-2',
        name: 'Navy Chinos',
        type: 'bottom',
        category: 'Pants',
        tags: ['workwear', 'casual'],
        colors: ['blue'],
        imageUrl: '/assets/placeholder-bottom.png',
        usageFrequency: 8,
        dateAdded: new Date('2024-02-10'),
        season: ['all-season'],
        style: ['workwear', 'casual']
      },
      {
        id: 'item-3',
        name: 'Black Midi Dress',
        type: 'dress',
        category: 'Dresses',
        tags: ['party', 'feminine'],
        colors: ['black'],
        imageUrl: '/assets/placeholder-dress.png',
        usageFrequency: 3,
        dateAdded: new Date('2024-03-05'),
        season: ['all-season'],
        style: ['party', 'feminine']
      },
      {
        id: 'item-4',
        name: 'Denim Jacket',
        type: 'outerwear',
        category: 'Jackets',
        tags: ['casual', 'travel'],
        colors: ['blue'],
        imageUrl: '/assets/placeholder-outerwear.png',
        usageFrequency: 15,
        dateAdded: new Date('2023-11-20'),
        season: ['summer', 'monsoon'],
        style: ['casual', 'travel']
      },
      {
        id: 'item-5',
        name: 'White Sneakers',
        type: 'shoes',
        category: 'Sneakers',
        tags: ['casual', 'athleisure'],
        colors: ['white'],
        imageUrl: '/assets/placeholder-shoes.png',
        usageFrequency: 20,
        dateAdded: new Date('2023-10-01'),
        season: ['all-season'],
        style: ['casual', 'athleisure']
      },
      {
        id: 'item-6',
        name: 'Beige Trench Coat',
        type: 'outerwear',
        category: 'Coats',
        tags: ['workwear', 'minimalist'],
        colors: ['beige'],
        imageUrl: '/assets/placeholder-outerwear.png',
        usageFrequency: 5,
        dateAdded: new Date('2024-01-01'),
        season: ['winter', 'monsoon'],
        style: ['workwear', 'minimalist']
      },
      {
        id: 'item-7',
        name: 'Floral Summer Dress',
        type: 'dress',
        category: 'Dresses',
        tags: ['casual', 'feminine'],
        colors: ['pastel', 'multi-color'],
        imageUrl: '/assets/placeholder-dress.png',
        usageFrequency: 0,
        dateAdded: new Date('2024-04-01'),
        season: ['summer'],
        style: ['casual', 'feminine']
      },
      {
        id: 'item-8',
        name: 'Black Skinny Jeans',
        type: 'bottom',
        category: 'Jeans',
        tags: ['casual', 'party'],
        colors: ['black'],
        imageUrl: '/assets/placeholder-bottom.png',
        usageFrequency: 18,
        dateAdded: new Date('2023-09-15'),
        season: ['all-season'],
        style: ['casual', 'party']
      },
      {
        id: 'item-9',
        name: 'Pastel Pink Cardigan',
        type: 'top',
        category: 'Cardigans',
        tags: ['casual', 'feminine'],
        colors: ['pastel'],
        imageUrl: '/assets/placeholder-top.png',
        usageFrequency: 2,
        dateAdded: new Date('2024-02-28'),
        season: ['winter', 'all-season'],
        style: ['casual', 'feminine']
      },
      {
        id: 'item-10',
        name: 'Leather Ankle Boots',
        type: 'shoes',
        category: 'Boots',
        tags: ['party', 'workwear'],
        colors: ['black'],
        imageUrl: '/assets/placeholder-shoes.png',
        usageFrequency: 7,
        dateAdded: new Date('2023-12-10'),
        season: ['winter', 'monsoon'],
        style: ['party', 'workwear']
      },
      {
        id: 'item-11',
        name: 'Blue Striped Shirt',
        type: 'top',
        category: 'Shirts',
        tags: ['workwear', 'casual'],
        colors: ['blue', 'white'],
        imageUrl: '/assets/placeholder-top.png',
        usageFrequency: 10,
        dateAdded: new Date('2024-01-20'),
        season: ['all-season'],
        style: ['workwear', 'casual']
      },
      {
        id: 'item-12',
        name: 'Silk Scarf',
        type: 'accessory',
        category: 'Scarves',
        tags: ['feminine', 'party'],
        colors: ['multi-color'],
        imageUrl: '/assets/placeholder-accessory.png',
        usageFrequency: 1,
        dateAdded: new Date('2024-03-15'),
        season: ['all-season'],
        style: ['feminine', 'party']
      }
    ];

    // Apply filters
    if (filters) {
      if (filters.itemType.length > 0) {
        items = items.filter(item => filters.itemType.includes(item.type));
      }
      if (filters.colors.length > 0) {
        items = items.filter(item =>
          item.colors.some(color => filters.colors.includes(color))
        );
      }
      if (filters.styles.length > 0) {
        items = items.filter(item =>
          item.style?.some(style => filters.styles.includes(style))
        );
      }
      if (filters.seasons.length > 0) {
        items = items.filter(item =>
          item.season?.some(season => filters.seasons.includes(season))
        );
      }
      if (filters.usage.length > 0) {
        items = items.filter(item => {
          if (filters.usage.includes('most-worn') && item.usageFrequency >= 10) return true;
          if (filters.usage.includes('under-used') && item.usageFrequency > 0 && item.usageFrequency < 5) return true;
          if (filters.usage.includes('never-worn') && item.usageFrequency === 0) return true;
          return false;
        });
      }
    }

    // Apply sorting
    if (sort) {
      switch (sort) {
        case 'recent':
          items.sort((a, b) => b.dateAdded.getTime() - a.dateAdded.getTime());
          break;
        case 'most-worn':
          items.sort((a, b) => b.usageFrequency - a.usageFrequency);
          break;
        case 'least-worn':
          items.sort((a, b) => a.usageFrequency - b.usageFrequency);
          break;
        case 'alphabetical':
          items.sort((a, b) => a.name.localeCompare(b.name));
          break;
      }
    }

    return items;
  }

  private transformOutfits(outfits: OutfitApiResponse[], filters?: CatalogFilters, sort?: SortOption): Outfit[] {
    let transformed: Outfit[] = outfits.map((outfit) => ({
      id: outfit.id,
      name: outfit.name,
      tags: outfit.tags || [],
      category: outfit.notes || undefined,
      imageUrl: outfit.imageUrl || outfit.items[0]?.imageUrl || '/assets/placeholder-outfit.png',
      lastModified: new Date(outfit.lastModified),
      pieceCount: outfit.pieceCount || outfit.items.length,
      items: outfit.items.map((item) => ({
        ...item,
        imageUrl: item.imageUrl || '/assets/placeholder-top.png',
        dateAdded: new Date(item.dateAdded),
        usageFrequency: item.usageFrequency || 0
      }))
    }));

    if (filters) {
      if (filters.styles.length > 0) {
        transformed = transformed.filter(outfit =>
          outfit.tags.some(tag => filters.styles.includes(tag))
        );
      }
      if (filters.outfitTypes.length > 0) {
        transformed = transformed.filter(outfit => {
          if (filters.outfitTypes.includes('2-piece') && outfit.pieceCount === 2) return true;
          if (filters.outfitTypes.includes('3-piece') && outfit.pieceCount === 3) return true;
          if (filters.outfitTypes.includes('4-piece') && outfit.pieceCount >= 4) return true;
          return false;
        });
      }
    }

    if (sort) {
      switch (sort) {
        case 'alphabetical':
          transformed.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'recent':
        default:
          transformed.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
          break;
      }
    }

    return transformed;
  }
}
