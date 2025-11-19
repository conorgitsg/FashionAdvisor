import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CatalogService,
  ClothingItem,
  Outfit,
  CatalogFilters,
  SortOption,
  ViewMode
} from '../../services/catalog.service';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.css'
})
export class CatalogComponent implements OnInit {
  protected clothingItems = signal<ClothingItem[]>([]);
  protected outfits = signal<Outfit[]>([]);
  protected loading = signal(true);
  protected viewMode = signal<ViewMode>('all');
  protected sortOption = signal<SortOption>('recent');
  protected activeQuickFilter = signal<string>('all');
  protected showFilterSheet = signal(false);

  protected filters = signal<CatalogFilters>({
    itemType: [],
    colors: [],
    styles: [],
    seasons: [],
    usage: [],
    outfitTypes: []
  });

  // Temp filters for the sheet
  protected sheetFilters: CatalogFilters = {
    itemType: [],
    colors: [],
    styles: [],
    seasons: [],
    usage: [],
    outfitTypes: []
  };

  protected quickFilters = [
    { id: 'all', label: 'All' },
    { id: 'top', label: 'Tops' },
    { id: 'bottom', label: 'Bottoms' },
    { id: 'dress', label: 'Dresses' },
    { id: 'outerwear', label: 'Outerwear' }
  ];

  protected sortOptions = [
    { value: 'recent', label: 'Most Recent' },
    { value: 'most-worn', label: 'Most Worn' },
    { value: 'least-worn', label: 'Least Worn' },
    { value: 'alphabetical', label: 'Alphabetical' }
  ];

  constructor(
    private catalogService: CatalogService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCatalog();
  }

  loadCatalog(): void {
    this.loading.set(true);

    const currentFilters = this.filters();
    const sort = this.sortOption();

    // Apply quick filter to item type
    if (this.activeQuickFilter() !== 'all') {
      currentFilters.itemType = [this.activeQuickFilter()];
    }

    this.catalogService.getClothingItems(currentFilters, sort).subscribe({
      next: (items) => {
        this.clothingItems.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load clothing items', err);
        this.loading.set(false);
      }
    });

    this.catalogService.getOutfits(currentFilters, sort).subscribe({
      next: (outfits) => {
        this.outfits.set(outfits);
      },
      error: (err) => {
        console.error('Failed to load outfits', err);
      }
    });
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  setQuickFilter(filterId: string): void {
    this.activeQuickFilter.set(filterId);

    // Reset item type filter and apply quick filter
    const currentFilters = this.filters();
    if (filterId === 'all') {
      currentFilters.itemType = [];
    } else {
      currentFilters.itemType = [filterId];
    }
    this.filters.set(currentFilters);
    this.loadCatalog();
  }

  setSortOption(option: SortOption): void {
    this.sortOption.set(option);
    this.loadCatalog();
  }

  openFilters(): void {
    // Copy current filters to sheet filters
    this.sheetFilters = JSON.parse(JSON.stringify(this.filters()));
    this.showFilterSheet.set(true);
  }

  closeFilters(): void {
    this.showFilterSheet.set(false);
  }

  toggleFilter(group: keyof CatalogFilters, value: string): void {
    const arr = this.sheetFilters[group] as string[];
    const index = arr.indexOf(value);
    if (index === -1) {
      arr.push(value);
    } else {
      arr.splice(index, 1);
    }
  }

  resetSheetFilters(): void {
    this.sheetFilters = {
      itemType: [],
      colors: [],
      styles: [],
      seasons: [],
      usage: [],
      outfitTypes: []
    };
  }

  applySheetFilters(): void {
    this.applyFilters(JSON.parse(JSON.stringify(this.sheetFilters)));
  }

  getColorValue(color: string): string {
    const colorMap: Record<string, string> = {
      'white': '#FFFFFF',
      'black': '#2B2B2B',
      'blue': '#4A90D9',
      'beige': '#D4C4B0',
      'pastel': '#FFD1DC',
      'multi-color': 'linear-gradient(135deg, #FF6B6B, #4ECDC4, #45B7D1)'
    };
    return colorMap[color] || '#E5E5E5';
  }

  applyFilters(filters: CatalogFilters): void {
    this.filters.set(filters);
    this.showFilterSheet.set(false);

    // Reset quick filter if item type filter is applied
    if (filters.itemType.length > 0) {
      this.activeQuickFilter.set('all');
    }

    this.loadCatalog();
  }

  resetFilters(): void {
    this.filters.set({
      itemType: [],
      colors: [],
      styles: [],
      seasons: [],
      usage: [],
      outfitTypes: []
    });
    this.activeQuickFilter.set('all');
    this.loadCatalog();
  }

  getActiveFilterCount(): number {
    const f = this.filters();
    return f.itemType.length + f.colors.length + f.styles.length +
           f.seasons.length + f.usage.length + f.outfitTypes.length;
  }

  getActiveFilterTags(): string[] {
    const f = this.filters();
    const tags: string[] = [];

    f.itemType.forEach(t => tags.push(this.capitalize(t)));
    f.colors.forEach(c => tags.push(this.capitalize(c)));
    f.styles.forEach(s => tags.push(this.capitalize(s)));
    f.seasons.forEach(s => tags.push(this.capitalize(s)));
    f.usage.forEach(u => tags.push(this.formatUsage(u)));
    f.outfitTypes.forEach(o => tags.push(o));

    return tags;
  }

  removeFilterTag(tag: string): void {
    const f = { ...this.filters() };
    const lowerTag = tag.toLowerCase();

    f.itemType = f.itemType.filter(t => t !== lowerTag);
    f.colors = f.colors.filter(c => c !== lowerTag);
    f.styles = f.styles.filter(s => s !== lowerTag);
    f.seasons = f.seasons.filter(s => s !== lowerTag);
    f.usage = f.usage.filter(u => this.formatUsage(u).toLowerCase() !== lowerTag);
    f.outfitTypes = f.outfitTypes.filter(o => o !== tag);

    this.filters.set(f);
    this.loadCatalog();
  }

  getItemTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'top': '👕',
      'bottom': '👖',
      'dress': '👗',
      'outerwear': '🧥',
      'shoes': '👟',
      'accessory': '👜'
    };
    return icons[type] || '👔';
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private formatUsage(usage: string): string {
    const map: Record<string, string> = {
      'most-worn': 'Most Worn',
      'under-used': 'Under-used',
      'never-worn': 'Never Worn'
    };
    return map[usage] || usage;
  }
}
