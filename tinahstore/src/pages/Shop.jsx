import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/icons/Icon.jsx';
import SEO from '../components/common/SEO.jsx';
import ProductCard from '../components/product/ProductCard.jsx';
import { formatKes } from '../data/products.js';
import { useProducts } from '../hooks/useProducts.js';
import { useCategories } from '../hooks/useCategories.js';

const PAGE_SIZE = 8;
const PRICE_MIN = 100;
const PRICE_MAX = 5000;

const initialFilters = {
  categories: [],
  maxPrice: 5000,
  query: '',
};

export default function Shop() {
  const { products, isLoading, error } = useProducts();
  const { categories, isLoading: categoriesLoading, error: categoriesError, retry: retryCategories } = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice);
  const filters = useMemo(() => ({
    categories: searchParams.getAll('category'),
    query: searchParams.get('search') || '',
    maxPrice,
  }), [searchParams, maxPrice]);
  useEffect(() => { setPage(1); }, [searchParams]);

  const facets = useMemo(() => buildFacets(products, categories), [products, categories]);
  const filteredProducts = useMemo(() => {
    const query = filters.query.trim().toLowerCase();

    return products
      .filter((product) => {
        return filters.categories.length === 0 || filters.categories.includes(categoryKey(product, categories));
      })
      .filter((product) => product.price <= filters.maxPrice)
      .filter((product) => {
        if (!query) return true;
        const catName = typeof product.category === 'object' ? product.category?.name : product.category;
        return [product.name, catName, product.description, product.planting_procedure].join(' ').toLowerCase().includes(query);
      })
      .sort(sortProducts(sort));
  }, [filters, products, categories, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleProducts = filteredProducts.slice(start, start + PAGE_SIZE);
  const activeFilterCount = filters.categories.length + (filters.maxPrice < PRICE_MAX ? 1 : 0) + (filters.query ? 1 : 0);

  function updateFilters(next) {
    if ('maxPrice' in next) setMaxPrice(next.maxPrice);
    if ('categories' in next || 'query' in next) {
      const params = new URLSearchParams(searchParams);
      if ('categories' in next) {
        params.delete('category');
        next.categories.forEach(value => params.append('category', value));
      }
      if ('query' in next) {
        if (next.query) params.set('search', next.query);
        else params.delete('search');
      }
      setSearchParams(params, { replace: true });
    }
    setPage(1);
  }

  function toggleFilter(key, value) {
    const values = filters[key];
    updateFilters({ [key]: values.includes(value) ? values.filter(item => item !== value) : [...values, value] });
  }

  function clearFilters() {
    updateFilters(initialFilters);
  }

  return (
    <>
      <SEO
        title="Shop All Fruit Seedlings - Savannah Seedlings"
        description="Browse certified high-yielding fruit seedlings including Grafted Hass Avocado, Pixie Orange, Kent Mango, Yellow Passion, Dragon Fruit & Pomegranate."
        url="/shop"
      />
      <div className="container">
        <nav className="breadcrumb">
          <Link to="/">Home</Link><span className="sep">/</span><span className="current">Shop Seedlings</span>
        </nav>
        <div className="page-head shop-head">
          <div>
            <p className="eyebrow">Fruit Seedling Catalog</p>
            <h2 className="h2">Shop all fruit seedlings</h2>
            <span className="muted" style={{ fontSize: 13.5 }}>{products.length} seedling varieties</span>
          </div>
          <button className="mobile-filter-btn" type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
            <Icon name="sliders" className="icon icon-sm" /> Filters {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 90 }}>
        <div className="shop-layout">
          <aside className={`filters ${filtersOpen ? 'open' : ''}`} aria-label="Product filters">
            <div className="shop-search">
              <Icon name="search" className="icon icon-sm" />
              <input
                type="search"
                value={filters.query}
                onChange={(event) => updateFilters({ query: event.target.value })}
                placeholder="Search avocado, mango, orange..."
              />
            </div>

            <FilterGroup
              title="Category"
              options={facets.categories}
              selected={filters.categories}
              onToggle={(value) => toggleFilter('categories', value)}
            />
            {categoriesLoading && <p className="muted" role="status">Loading categories...</p>}
            {categoriesError && <p className="muted" role="status">Some categories could not be loaded. <button type="button" className="clear-filters" onClick={retryCategories}>Try again</button></p>}

            <div className="filter-group">
              <h4>Max Price per seedling <span>{formatKes(filters.maxPrice)}</span></h4>
              <div className="price-range">
                <span className="mono" style={{ fontSize: 12 }}>100</span>
                <input
                  type="range"
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  step="50"
                  value={filters.maxPrice}
                  onChange={(event) => updateFilters({ maxPrice: Number(event.target.value) })}
                  aria-label="Maximum price"
                />
                <span className="mono" style={{ fontSize: 12 }}>5k</span>
              </div>
            </div>

            <div style={{ paddingTop: 18 }}>
              <button className="clear-filters" type="button" onClick={clearFilters} disabled={activeFilterCount === 0}>Clear all filters</button>
            </div>
          </aside>

          <div>
            {activeFilterCount > 0 && (
              <div className="active-filters" aria-label="Active filters">
                {filters.query && <FilterChip label={`Search: ${filters.query}`} onRemove={() => updateFilters({ query: '' })} />}
                {filters.categories.map(value => <FilterChip label={facets.categories.find(option => option.value === value)?.label || value} key={value} onRemove={() => toggleFilter('categories', value)} />)}
                {filters.maxPrice < PRICE_MAX && <FilterChip label={`Under ${formatKes(filters.maxPrice)}`} onRemove={() => updateFilters({ maxPrice: PRICE_MAX })} />}
              </div>
            )}

            <div className="toolbar">
              <span className="count">{resultText(filteredProducts.length, start, visibleProducts.length)}</span>
              <div className="toolbar-right">
                <select className="sort-select" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label="Sort products">
                  <option value="newest">Sort: Newest</option>
                  <option value="low">Price: low to high</option>
                  <option value="high">Price: high to low</option>
                  <option value="rating">Highest rated</option>
                </select>
                <div className="view-toggle" aria-label="View mode">
                  <button type="button" className={view === 'grid' ? 'active' : ''} aria-label="Grid view" onClick={() => setView('grid')}><Icon name="grid" className="icon icon-sm" /></button>
                  <button type="button" className={view === 'list' ? 'active' : ''} aria-label="List view" onClick={() => setView('list')}><Icon name="list" className="icon icon-sm" /></button>
                </div>
              </div>
            </div>

            {isLoading && <div className="shop-empty"><h3>Loading seedlings...</h3></div>}
            {error && <div className="shop-empty"><h3>We could not load the seedling catalog.</h3><p className="muted">Please try refreshing the page.</p></div>}
            {!isLoading && !error && visibleProducts.length === 0 && (
              <div className="shop-empty">
                <Icon name="search" className="icon icon-lg" />
                <h3>No seedlings match those filters</h3>
                <p className="muted">Try adjusting the max price or clearing search keywords.</p>
                <button className="btn btn-outline btn-sm" type="button" onClick={clearFilters}>Clear filters</button>
              </div>
            )}

            {visibleProducts.length > 0 && (
              <div className={`product-grid ${view === 'list' ? 'shop-list-view' : ''}`}>
                {visibleProducts.map((product) => (
                  <ProductCard
                    product={product}
                    key={product.id}
                    quickAdd
                    className={view === 'list' ? 'list-card' : ''}
                  />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="pagination" aria-label="Pagination">
                <button type="button" aria-label="Previous" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><Icon name="chevronLeft" className="icon icon-sm" /></button>
                {Array.from({ length: totalPages }).map((_, index) => (
                  <button type="button" className={currentPage === index + 1 ? 'active' : ''} key={index + 1} onClick={() => setPage(index + 1)}>{index + 1}</button>
                ))}
                <button type="button" aria-label="Next" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><Icon name="chevronRight" className="icon icon-sm" /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function FilterGroup({ title, options, selected, onToggle }) {
  return (
    <div className="filter-group">
      <h4>{title}</h4>
      {options.map((option) => (
        <label className="filter-row" key={option.value}>
          <input
            type="checkbox"
            value={option.value}
            checked={selected.includes(option.value)}
            onChange={() => onToggle(option.value)}
          />
          {option.label}
          <span className="count">({option.count})</span>
        </label>
      ))}
    </div>
  );
}

function FilterChip({ label, onRemove }) {
  return (
    <button className="filter-chip" type="button" onClick={onRemove}>
      {label}<Icon name="x" className="icon icon-sm" />
    </button>
  );
}

function categoryKey(product, categories) {
  const name = typeof product.category === 'object' ? product.category?.name : product.category;
  // Name lookup keeps frontend-first deployments compatible with the old API.
  return product.category_slug || product.category?.slug || categories.find(category => category.name === name)?.slug || name;
}

function buildFacets(products, categories) {
  const options = new Map(categories.map(category => [category.slug, { value: category.slug, label: category.name, count: 0 }]));
  for (const product of products) {
    const value = categoryKey(product, categories);
    if (!value) continue;
    const name = typeof product.category === 'object' ? product.category?.name : product.category;
    const option = options.get(value) || { value, label: name, count: 0 };
    option.count += 1;
    options.set(value, option);
  }
  return { categories: [...options.values()].sort((a, b) => a.label.localeCompare(b.label)) };
}

function sortProducts(sort) {
  return (a, b) => {
    if (sort === 'low') return a.price - b.price;
    if (sort === 'high') return b.price - a.price;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  };
}

function resultText(total, start, visibleCount) {
  if (total === 0) return 'No results';
  return `Showing ${start + 1}-${start + visibleCount} of ${total} seedling varieties`;
}
