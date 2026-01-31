import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL;

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

function App() {
  // State declarations
  const [searchQuery, setSearchQuery] = useState('');
  const [packages, setPackages] = useState([]);
  const [individualTests, setIndividualTests] = useState([]);
  const [expandedPackage, setExpandedPackage] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branches, setBranches] = useState([]);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState('search');
  const [bookingForm, setBookingForm] = useState({
    patient_name: '',
    patient_phone: '',
    patient_email: '',
    appointment_date: '',
    appointment_time_slot: 'morning',
    patient_notes: ''
  });
  const [bookingResult, setBookingResult] = useState(null);
  const [packageComponents, setPackageComponents] = useState({});
  const [testCart, setTestCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [displayedPackages, setDisplayedPackages] = useState(10);
  const [displayedTests, setDisplayedTests] = useState(10);
  const [selectedPackageForBooking, setSelectedPackageForBooking] = useState(null);
  const [bookingMode, setBookingMode] = useState(null);
  const [activeTab, setActiveTab] = useState('packages');
  const [selectedTier, setSelectedTier] = useState(null);
  const [showTierModal, setShowTierModal] = useState(false);
  const [pendingService, setPendingService] = useState(null);

  // New states for enhanced search
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [popularServices, setPopularServices] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Debounced search query for suggestions
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Fetch popular services on mount
  useEffect(() => {
    const fetchPopular = async () => {
      try {
        const response = await fetch(`${API_URL}/api/search/popular`);
        const data = await response.json();
        if (data.success) {
          setPopularServices(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching popular services:', error);
      }
    };
    fetchPopular();
  }, []);

  // Fetch suggestions when query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const normalizedQuery = removeAccents(debouncedQuery);
        const response = await fetch(
          `${API_URL}/api/search/suggestions?q=${encodeURIComponent(normalizedQuery)}`
        );
        const data = await response.json();
        if (data.success) {
          setSuggestions(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      }
    };
    fetchSuggestions();
  }, [debouncedQuery]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to get price display for tiered pricing
  const getPriceDisplay = (service) => {
    if (service.pricing_data && Array.isArray(service.pricing_data) && service.pricing_data.length > 0) {
      const prices = service.pricing_data.map(t => t.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      if (minPrice === maxPrice) {
        return `${minPrice.toLocaleString('vi-VN')} đ`;
      }
      return `${minPrice.toLocaleString('vi-VN')} - ${maxPrice.toLocaleString('vi-VN')} đ`;
    }
    return service.discounted_price ? `${service.discounted_price.toLocaleString('vi-VN')} đ` : 'Liên hệ';
  };

  // Get default tier from pricing data
  const getDefaultTier = (pricingData) => {
    if (!pricingData || !Array.isArray(pricingData)) return null;
    return pricingData.find(t => t.is_default) || pricingData[0];
  };

  // Helper to remove accents
  const removeAccents = (str) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  // Highlight matching text in search results
  const highlightMatch = useCallback((text, query) => {
    if (!query || !text) return text;

    const queryNorm = removeAccents(query.trim());
    const queryWords = queryNorm.split(/\s+/).filter(w => w.length >= 2);

    if (queryWords.length === 0) return text;

    // Create regex pattern for all query words
    const escapedWords = queryWords.map(w =>
      w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const pattern = new RegExp(`(${escapedWords.join('|')})`, 'gi');

    // Find matching parts in normalized text
    const textNorm = removeAccents(text);
    const matches = [];
    let match;

    while ((match = pattern.exec(textNorm)) !== null) {
      matches.push({ start: match.index, end: match.index + match[0].length });
    }

    if (matches.length === 0) return text;

    // Build highlighted text using original characters
    const parts = [];
    let lastEnd = 0;

    matches.forEach(({ start, end }) => {
      if (start > lastEnd) {
        parts.push(<span key={`text-${lastEnd}`}>{text.slice(lastEnd, start)}</span>);
      }
      parts.push(
        <mark key={`match-${start}`} className="search-highlight">
          {text.slice(start, end)}
        </mark>
      );
      lastEnd = end;
    });

    if (lastEnd < text.length) {
      parts.push(<span key={`text-${lastEnd}`}>{text.slice(lastEnd)}</span>);
    }

    return <>{parts}</>;
  }, []);

  // Calculate relevance score
  const calculateRelevance = (service, searchQuery) => {
    const query = removeAccents(searchQuery).trim();
    const name = removeAccents(service.provider_service_name_vn);
    const description = removeAccents(service.short_description || '');
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    
    let score = 0;
    
    const allWordsInName = queryWords.every(word => name.includes(word));
    const allWordsInDescription = queryWords.every(word => description.includes(word));
    
    if (!allWordsInName && !allWordsInDescription) {
      const someWordsMatch = queryWords.some(word => name.includes(word) || description.includes(word));
      if (!someWordsMatch) {
        return 0;
      }
      return 5;
    }
    
    if (name === query) {
      score += 100;
    } else if (name.startsWith(query)) {
      score += 80;
    } else if (name.includes(query)) {
      score += 60;
    } else if (allWordsInName) {
      score += 40;
      const firstWordIndex = name.indexOf(queryWords[0]);
      const lastWordIndex = name.indexOf(queryWords[queryWords.length - 1]);
      const distance = lastWordIndex - firstWordIndex;
      if (distance < 20) score += 10;
    } else if (allWordsInDescription) {
      score += 20;
    }
    
    if (service.service_type === 'package') {
      score += 10;
    }
    
    queryWords.forEach(word => {
      const wordBoundaryRegex = new RegExp(`\\b${word}\\b`);
      if (wordBoundaryRegex.test(name)) {
        score += 5;
      }
    });
    
    if (name.length > 100) {
      score -= 5;
    }
    
    return score;
  };

  // Cart management functions
  const addToCart = (test) => {
    if (bookingMode === 'package' && selectedPackageForBooking) {
      const confirmed = window.confirm(
        `Bạn đang chọn gói "${selectedPackageForBooking.provider_service_name_vn}". Thêm xét nghiệm lẻ sẽ hủy chọn gói. Tiếp tục?`
      );
      if (!confirmed) return;
      
      setSelectedPackageForBooking(null);
    }

    if (testCart.find(t => t.id === test.id)) {
      alert('Xét nghiệm này đã có trong giỏ');
      return;
    }
    
    setTestCart([...testCart, test]);
    setBookingMode('tests');
  };

  const removeFromCart = (testId) => {
    const newCart = testCart.filter(t => t.id !== testId);
    setTestCart(newCart);
    
    if (newCart.length === 0) {
      setShowCart(false);
      setBookingMode(null);
    }
  };

  const clearCart = () => {
    if (window.confirm('Xóa tất cả xét nghiệm trong giỏ?')) {
      setTestCart([]);
      setShowCart(false);
      setBookingMode(null);
    }
  };

  const cartTotal = testCart.reduce((sum, test) => 
    sum + (parseFloat(test.discounted_price) || 0), 0
  );

  const handleBookCart = async () => {
    if (testCart.length === 0) {
      alert('Giỏ xét nghiệm trống');
      return;
    }
    
    const cartService = {
      id: 'cart',
      provider_service_name_vn: `Đặt lẻ ${testCart.length} xét nghiệm`,
      discounted_price: cartTotal,
      service_type: 'custom_bundle',
      providers: testCart[0].providers,
      cart_items: testCart
    };
    
    setSelectedService(cartService);
    setBookingMode('tests');
    setLoading(true);
    
    try {
      const branchAvailability = {};
      
      for (const test of testCart) {
        const response = await fetch(`${API_URL}/api/services/${test.id}/branches`);
        const data = await response.json();
        
        data.data?.forEach(branch => {
          if (!branchAvailability[branch.id]) {
            branchAvailability[branch.id] = {
              branch,
              availableTests: []
            };
          }
          branchAvailability[branch.id].availableTests.push(test.id);
        });
      }
      
      const validBranches = Object.values(branchAvailability)
        .filter(b => b.availableTests.length === testCart.length)
        .map(b => b.branch);
      
      if (validBranches.length === 0) {
        alert('Không tìm thấy chi nhánh nào cung cấp tất cả các xét nghiệm đã chọn');
        setLoading(false);
        return;
      }
      
      setBranches(validBranches);
      setShowBranchModal(true);
    } catch (error) {
      alert('Lỗi tải chi nhánh: ' + error.message);
    }
    setLoading(false);
  };

  const loadMorePackages = () => {
    setDisplayedPackages(prev => prev + 10);
  };

  const loadMoreTests = () => {
    setDisplayedTests(prev => prev + 10);
  };

  // Perform search with given query
  const performSearch = useCallback(async (query) => {
    if (!query?.trim()) return;

    setLoading(true);
    setShowSuggestions(false);
    setHasSearched(true);

    try {
      const normalizedQuery = removeAccents(query);
      const response = await fetch(
        `${API_URL}/api/search/services?q=${encodeURIComponent(normalizedQuery)}`
      );
      const data = await response.json();

      // Filter packages: only root packages
      let pkgs = data.data.filter(s =>
        s.service_type === 'package' &&
        s.parent_service_id === null
      );

      // Filter tests: ALL atomic services
      let tests = data.data.filter(s =>
        s.service_type === 'atomic'
      );

      // Sort packages by relevance
      pkgs = pkgs.map(pkg => ({
        ...pkg,
        relevanceScore: calculateRelevance(pkg, query)
      })).sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Sort tests by relevance, prioritizing standalone tests
      tests = tests.map(test => ({
        ...test,
        relevanceScore: calculateRelevance(test, query),
        isInPackage: test.parent_service_id !== null
      })).sort((a, b) => {
        // Primary sort: by relevance
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        // Secondary sort: standalone tests first
        if (a.isInPackage !== b.isInPackage) {
          return a.isInPackage ? 1 : -1;
        }
        return 0;
      });

      setPackages(pkgs);
      setIndividualTests(tests);
      setDisplayedPackages(10);
      setDisplayedTests(10);

      // Auto-switch to tab with more results
      if (pkgs.length > 0 && tests.length === 0) {
        setActiveTab('packages');
      } else if (tests.length > 0 && pkgs.length === 0) {
        setActiveTab('tests');
      }

    } catch (error) {
      alert('Lỗi tìm kiếm: ' + error.message);
    }
    setLoading(false);
  }, []);

  // Search services wrapper
  const handleSearch = () => {
    performSearch(searchQuery);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion) => {
    setSearchQuery(suggestion.name);
    setShowSuggestions(false);
    performSearch(suggestion.name);
  };

  // Handle popular service selection
  const handlePopularSelect = (service) => {
    setSearchQuery(service.provider_service_name_vn);
    performSearch(service.provider_service_name_vn);
  };

  // Get package components
  const loadPackageComponents = async (packageId) => {
    if (packageComponents[packageId]) {
      setExpandedPackage(expandedPackage === packageId ? null : packageId);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/services/${packageId}`);
      const data = await response.json();
      
      if (data.success && data.data.components) {
        setPackageComponents(prev => ({
          ...prev,
          [packageId]: data.data.components
        }));
      }
      setExpandedPackage(expandedPackage === packageId ? null : packageId);
    } catch (error) {
      console.error('Error loading components:', error);
    }
  };

  // Select service and load branches
  const handleSelectService = async (service) => {
    if (bookingMode === 'tests' && testCart.length > 0) {
      const confirmed = window.confirm(
        `Bạn đang có ${testCart.length} xét nghiệm trong giỏ. Chọn gói này sẽ xóa giỏ xét nghiệm. Tiếp tục?`
      );
      if (!confirmed) return;

      setTestCart([]);
      setShowCart(false);
    }

    // If service has tiered pricing, show tier selector first
    if (service.pricing_data && Array.isArray(service.pricing_data) && service.pricing_data.length > 0) {
      setPendingService(service);
      setSelectedTier(getDefaultTier(service.pricing_data));
      setShowTierModal(true);
      return;
    }

    // No tiered pricing - proceed directly to branch selection
    proceedTobranchSelection(service, null);
  };

  // Proceed to branch selection after tier is selected (or no tier needed)
  const proceedTobranchSelection = async (service, tier) => {
    const serviceWithTier = tier ? {
      ...service,
      selectedTier: tier,
      displayPrice: tier.price,
    } : service;

    setSelectedService(serviceWithTier);
    setBookingMode('package');
    setSelectedPackageForBooking(serviceWithTier);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/services/${service.id}/branches`);
      const data = await response.json();
      setBranches(data.data || []);
      setShowBranchModal(true);
    } catch (error) {
      alert('Lỗi tải chi nhánh: ' + error.message);
    }
    setLoading(false);
  };

  // Handle tier selection confirmation
  const handleConfirmTier = () => {
    if (pendingService && selectedTier) {
      setShowTierModal(false);
      proceedTobranchSelection(pendingService, selectedTier);
      setPendingService(null);
    }
  };

  // Filter branches
  const filteredBranches = branches.filter(branch => {
    const matchSearch = !branchSearchQuery || 
      removeAccents(branch.branch_name_vn + ' ' + branch.address)
        .includes(removeAccents(branchSearchQuery));
    const matchDistrict = !selectedDistrict || branch.district === selectedDistrict;
    const matchCity = !selectedCity || branch.city === selectedCity;
    return matchSearch && matchDistrict && matchCity;
  });

  // Get unique districts and cities
  const districts = [...new Set(branches.map(b => b.district))].filter(Boolean);
  const cities = [...new Set(branches.map(b => b.city))].filter(Boolean);

  // Select branch and go to booking
  const handleSelectBranch = (branch) => {
    setSelectedBranch(branch);
    setShowBranchModal(false);
    setCurrentView('booking');
  };

  // Create booking
  const handleCreateBooking = async (e) => {
    e.preventDefault();
    
    setLoading(true);
    try {
      const bookingData = {
        branch_id: selectedBranch.id,
        ...bookingForm,
        created_by_email: 'cs@hellobacsi.com'
      };

      // Add either provider_service_id or cart_items
      if (selectedService.service_type === 'custom_bundle') {
        bookingData.cart_items = selectedService.cart_items;
      } else {
        bookingData.provider_service_id = selectedService.id;
      }

      // Add selected tier info if present
      if (selectedService.selectedTier) {
        bookingData.selected_tier_price = selectedService.selectedTier.price;
        bookingData.selected_tier = selectedService.selectedTier.tier;
        bookingData.selected_tier_label = selectedService.selectedTier.label;
      }

      const response = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setBookingResult(data.data);
        setCurrentView('confirmation');
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (error) {
      alert('Lỗi tạo lịch hẹn: ' + error.message);
    }
    setLoading(false);
  };

  // Reset to home
  const handleGoHome = () => {
    setCurrentView('search');
    setSearchQuery('');
    setPackages([]);
    setIndividualTests([]);
    setSelectedService(null);
    setSelectedBranch(null);
    setBookingForm({
      patient_name: '',
      patient_phone: '',
      patient_email: '',
      appointment_date: '',
      appointment_time_slot: 'morning',
      patient_notes: ''
    });
    setBookingResult(null);
    setExpandedPackage(null);
    setTestCart([]);
    setShowCart(false);
    setBookingMode(null);
    setSelectedPackageForBooking(null);
  };

  return (
    <div className="App">
      <header className="header">
        <h1>Đặt lịch</h1>
        <div className="header-subtitle">Hello Health Group</div>
      </header>

      {/* SEARCH VIEW */}
      {currentView === 'search' && (
        <div className="container">
          <div className="search-section">
            <div className="search-box-wrapper">
              <div className="search-box">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Tìm theo tên dịch vụ, gói xét nghiệm..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  autoFocus
                />
                <button onClick={handleSearch} disabled={loading}>
                  {loading ? 'Đang tìm...' : 'Tìm kiếm'}
                </button>
              </div>

              {/* Autocomplete suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="suggestions-dropdown" ref={suggestionsRef}>
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="suggestion-item"
                      onClick={() => handleSuggestionSelect(suggestion)}
                    >
                      <span className="suggestion-icon">
                        {suggestion.type === 'package' ? '📦' : '🔬'}
                      </span>
                      <div className="suggestion-content">
                        <span className="suggestion-name">{suggestion.name}</span>
                        {suggestion.provider && (
                          <span className="suggestion-provider">{suggestion.provider}</span>
                        )}
                      </div>
                      {suggestion.price && (
                        <span className="suggestion-price">
                          {suggestion.price.toLocaleString('vi-VN')} đ
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Popular services when no search has been done */}
            {!hasSearched && popularServices.length > 0 && (
              <div className="popular-services">
                <div className="popular-header">Dịch vụ phổ biến</div>
                <div className="popular-list">
                  {popularServices.slice(0, 6).map((service) => (
                    <div
                      key={service.id}
                      className="popular-item"
                      onClick={() => handlePopularSelect(service)}
                    >
                      <span className="popular-icon">
                        {service.service_type === 'package' ? '📦' : '🔬'}
                      </span>
                      <span className="popular-name">{service.provider_service_name_vn}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SEARCH RESULTS WITH TABS */}
            {(packages.length > 0 || individualTests.length > 0) && (
              <div className="results-section">
                {/* Tabs */}
                <div className="results-tabs">
                  <button
                    className={`tab-button ${activeTab === 'packages' ? 'active' : ''}`}
                    onClick={() => setActiveTab('packages')}
                  >
                    <span className="tab-label">Gói</span>
                    <span className="tab-count">{packages.length}</span>
                  </button>
                  <button
                    className={`tab-button ${activeTab === 'tests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tests')}
                  >
                    <span className="tab-label">Dịch vụ lẻ</span>
                    <span className="tab-count">{individualTests.length}</span>
                  </button>
                </div>

                {/* Tab Content */}
                <div className="tab-content">
                  {/* PACKAGES TAB */}
                  {activeTab === 'packages' && packages.length > 0 && (
                    <div className="packages-tab">
                      <div className="results-list">
                        {packages.slice(0, displayedPackages).map((pkg, index) => (
                          <div key={pkg.id} className="result-card package-card">
                            {index === 0 && (
                              <div className="recommended-badge">KHUYẾN NGHỊ</div>
                            )}

                            <div className="result-header">
                              <div className="result-title">
                                {highlightMatch(pkg.provider_service_name_vn, searchQuery)}
                              </div>
                              <div className="result-meta">
                                <span className="provider-name">{pkg.providers?.brand_name_vn}</span>
                                <span className="price">
                                  {pkg.pricing_data && pkg.pricing_data.length > 0 && (
                                    <span className="price-prefix">Từ </span>
                                  )}
                                  {getPriceDisplay(pkg)}
                                </span>
                              </div>
                              {pkg.pricing_data && pkg.pricing_data.length > 0 && (
                                <div className="tier-badge">{pkg.pricing_data.length} mức giá</div>
                              )}
                            </div>

                            {pkg.suitable_for && pkg.suitable_for.length > 0 && (
                              <div className="suitable-for-box">
                                <div className="suitable-for-header">PHÙ HỢP VỚI:</div>
                                <div className="suitable-for-list">
                                  {pkg.suitable_for.map((item, i) => (
                                    <div key={i} className="suitable-for-item">{item}</div>
                                  ))}
                                </div>
                                {pkg.target_age_group && (
                                  <div className="age-group">Độ tuổi: {pkg.target_age_group}</div>
                                )}
                              </div>
                            )}

                            {pkg.key_benefits && pkg.key_benefits.length > 0 && (
                              <div className="benefits">
                                {pkg.key_benefits.slice(0, 3).map((benefit, i) => (
                                  <div key={i} className="benefit-item">{benefit}</div>
                                ))}
                              </div>
                            )}

                            <div className="result-actions">
                              <button 
                                className="btn-secondary"
                                onClick={() => loadPackageComponents(pkg.id)}
                              >
                                {expandedPackage === pkg.id ? 'Ẩn chi tiết' : 'Xem gói bao gồm'}
                              </button>
                              <button 
                                className="btn-primary btn-choose-package"
                                onClick={() => handleSelectService(pkg)}
                              >
                                CHỌN GÓI NÀY
                              </button>
                            </div>

                            {expandedPackage === pkg.id && packageComponents[pkg.id] && (
                              <div className="package-components">
                                <div className="components-header">
                                  Gói bao gồm {packageComponents[pkg.id].length} xét nghiệm:
                                </div>
                                <div className="components-list">
                                  {packageComponents[pkg.id].map((comp, idx) => (
                                    <div key={idx} className="component-item">
                                      <span className="component-number">{idx + 1}.</span>
                                      <span className="component-name">
                                        {comp.component?.display_name || comp.component?.provider_service_name_vn}
                                      </span>
                                      {(comp.component?.display_price || comp.component?.discounted_price) && (
                                        <span className="component-price">
                                          {(comp.component?.display_price || comp.component?.discounted_price)?.toLocaleString('vi-VN')} đ
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {packages.length > displayedPackages && (
                        <div className="load-more-section">
                          <button className="btn-load-more" onClick={loadMorePackages}>
                            Xem thêm {Math.min(10, packages.length - displayedPackages)} gói
                          </button>
                          <div className="results-count">
                            Hiển thị {displayedPackages} / {packages.length}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TESTS TAB */}
                  {activeTab === 'tests' && individualTests.length > 0 && (
                    <div className="tests-tab">
                      <div className="warning-box">
                        ⚠️ Khuyến nghị đặt gói để tiết kiệm chi phí
                      </div>

                      <div className="results-list">
                        {individualTests.slice(0, displayedTests).map(test => (
                          <div key={test.id} className="result-card test-card">
                            <div className="result-header">
                              <div className="result-title">
                                {highlightMatch(test.provider_service_name_vn, searchQuery)}
                              </div>
                              <div className="result-meta">
                                <span className="provider-name">{test.providers?.brand_name_vn}</span>
                                {test.discounted_price ? (
                                  <span className="price">{test.discounted_price?.toLocaleString('vi-VN')} đ</span>
                                ) : (
                                  <span className="price-unavailable">Liên hệ</span>
                                )}
                              </div>
                            </div>
                            {/* NEW: Show if test is in a package */}
    {test.parent_service_id && (
      <div className="test-package-note">
        💡 Tiết kiệm hơn khi đặt gói
      </div>
    )}

    {test.short_description && (
      <div className="test-description">{test.short_description}</div>
    )}

    <div className="result-actions">
      {/* ... existing buttons ... */}
    </div>

                            {test.short_description && (
                              <div className="test-description">{test.short_description}</div>
                            )}

                            <div className="result-actions">
                              {test.discounted_price ? (
                                <>
                                  {testCart.find(t => t.id === test.id) ? (
                                    <button 
                                      className="btn-added"
                                      onClick={() => removeFromCart(test.id)}
                                    >
                                      ✓ Đã thêm
                                    </button>
                                  ) : (
                                    <button 
                                      className="btn-primary"
                                      onClick={() => addToCart(test)}
                                    >
                                      + Thêm vào giỏ
                                    </button>
                                  )}
                                </>
                              ) : (
                                <button className="btn-disabled" disabled>
                                  Không thể đặt trực tuyến
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {individualTests.length > displayedTests && (
                        <div className="load-more-section">
                          <button className="btn-load-more" onClick={loadMoreTests}>
                            Xem thêm {Math.min(10, individualTests.length - displayedTests)} xét nghiệm
                          </button>
                          <div className="results-count">
                            Hiển thị {displayedTests} / {individualTests.length}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Empty states */}
                  {activeTab === 'packages' && packages.length === 0 && (
                    <div className="no-results">
                      Không tìm thấy gói dịch vụ phù hợp
                    </div>
                  )}
                  {activeTab === 'tests' && individualTests.length === 0 && (
                    <div className="no-results">
                      Không tìm thấy xét nghiệm đơn lẻ phù hợp
                    </div>
                  )}
                </div>
              </div>
            )}

            {packages.length === 0 && individualTests.length === 0 && searchQuery && !loading && (
              <div className="no-results">
                Không tìm thấy dịch vụ phù hợp
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOOKING VIEW */}
      {currentView === 'booking' && selectedService && selectedBranch && (
        <div className="container">
          <div className="booking-section">
            <div className="breadcrumb">
              <span onClick={() => setCurrentView('search')} className="breadcrumb-link">Tìm kiếm</span>
              <span className="breadcrumb-separator">&gt;</span>
              <span>Đặt lịch</span>
            </div>

            <div className="selected-info-box">
              <div className="info-group">
                <div className="info-label">Dịch vụ đã chọn:</div>
                <div className="info-value">{selectedService.provider_service_name_vn}</div>
                <div className="info-sub">
                  {selectedService.providers?.brand_name_vn} • {' '}
                  {(selectedService.selectedTier?.price || selectedService.discounted_price)?.toLocaleString('vi-VN')} đ
                </div>
                {selectedService.selectedTier && (
                  <div className="selected-tier-info">
                    <span className="tier-label-badge">{selectedService.selectedTier.label}</span>
                    {selectedService.selectedTier.features && (
                      <span className="tier-features-summary">
                        {selectedService.selectedTier.features.join(' • ')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="info-group">
                <div className="info-label">Chi nhánh:</div>
                <div className="info-value">{selectedBranch.branch_name_vn}</div>
                <div className="info-sub">{selectedBranch.address}</div>
                <button 
                  className="btn-text"
                  onClick={() => setShowBranchModal(true)}
                >
                  Thay đổi chi nhánh
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateBooking} className="booking-form">
              <h2>Thông tin bệnh nhân</h2>

              <div className="form-row">
                <div className="form-group">
                  <label>Họ tên *</label>
                  <input
                    type="text"
                    required
                    value={bookingForm.patient_name}
                    onChange={(e) => setBookingForm({...bookingForm, patient_name: e.target.value})}
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div className="form-group">
                  <label>Số điện thoại *</label>
                  <input
                    type="tel"
                    required
                    value={bookingForm.patient_phone}
                    onChange={(e) => setBookingForm({...bookingForm, patient_phone: e.target.value})}
                    placeholder="0901234567"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={bookingForm.patient_email}
                  onChange={(e) => setBookingForm({...bookingForm, patient_email: e.target.value})}
                  placeholder="email@example.com"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ngày hẹn *</label>
                  <input
                    type="date"
                    required
                    value={bookingForm.appointment_date}
                    onChange={(e) => setBookingForm({...bookingForm, appointment_date: e.target.value})}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="form-group">
                  <label>Khung giờ *</label>
                  <select
                    value={bookingForm.appointment_time_slot}
                    onChange={(e) => setBookingForm({...bookingForm, appointment_time_slot: e.target.value})}
                  >
                    <option value="morning">Buổi sáng (7:00 - 12:00)</option>
                    <option value="afternoon">Buổi chiều (13:00 - 17:00)</option>
                    <option value="evening">Buổi tối (17:00 - 20:00)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Ghi chú</label>
                <textarea
                  value={bookingForm.patient_notes}
                  onChange={(e) => setBookingForm({...bookingForm, patient_notes: e.target.value})}
                  placeholder="Ghi chú về tình trạng sức khỏe, yêu cầu đặc biệt..."
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setCurrentView('search')}
                >
                  Quay lại
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Đang xử lý...' : 'Xác nhận đặt lịch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION VIEW */}
      {currentView === 'confirmation' && bookingResult && (
        <div className="container">
          <div className="confirmation-section">
            <div className="confirmation-header">
              <h1>Đặt lịch thành công</h1>
              <div className="booking-reference">
                Mã đặt lịch: <strong>{bookingResult.booking_reference}</strong>
              </div>
            </div>

            <div className="confirmation-details">
              <div className="detail-group">
                <h3>Thông tin bệnh nhân</h3>
                <table>
                  <tbody>
                    <tr>
                      <td>Họ tên:</td>
                      <td><strong>{bookingResult.patient_name}</strong></td>
                    </tr>
                    <tr>
                      <td>Số điện thoại:</td>
                      <td><strong>{bookingResult.patient_phone}</strong></td>
                    </tr>
                    {bookingResult.patient_email && (
                      <tr>
                        <td>Email:</td>
                        <td>{bookingResult.patient_email}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="detail-group">
                <h3>Dịch vụ</h3>
                <table>
                  <tbody>
                    {selectedService.service_type === 'custom_bundle' ? (
                      <>
                        <tr>
                          <td>Loại:</td>
                          <td><strong>Đặt lẻ nhiều xét nghiệm</strong></td>
                        </tr>
                        <tr>
                          <td>Xét nghiệm:</td>
                          <td>
                            {selectedService.cart_items.map((item, idx) => (
                              <div key={item.id}>
                                {idx + 1}. {item.provider_service_name_vn}
                              </div>
                            ))}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr>
                          <td>Tên dịch vụ:</td>
                          <td><strong>{selectedService.provider_service_name_vn}</strong></td>
                        </tr>
                      </>
                    )}
                    <tr>
                      <td>Nhà cung cấp:</td>
                      <td>{selectedService.providers?.brand_name_vn}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="detail-group">
                <h3>Chi nhánh</h3>
                <table>
                  <tbody>
                    <tr>
                      <td>Tên chi nhánh:</td>
                      <td><strong>{selectedBranch.branch_name_vn}</strong></td>
                    </tr>
                    <tr>
                      <td>Địa chỉ:</td>
                      <td>{selectedBranch.address}</td>
                    </tr>
                    <tr>
                      <td>Liên hệ:</td>
                      <td>{selectedBranch.notification_email || selectedBranch.phone}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="detail-group">
                <h3>Thời gian</h3>
                <table>
                  <tbody>
                    <tr>
                      <td>Ngày hẹn:</td>
                      <td><strong>{new Date(bookingResult.appointment_date).toLocaleDateString('vi-VN')}</strong></td>
                    </tr>
                    <tr>
                      <td>Khung giờ:</td>
                      <td>{bookingResult.appointment_time_slot === 'morning' ? 'Buổi sáng (7:00-12:00)' : 
                           bookingResult.appointment_time_slot === 'afternoon' ? 'Buổi chiều (13:00-17:00)' :
                           'Buổi tối (17:00-20:00)'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="detail-group">
                <h3>Thanh toán</h3>
                <table>
                  <tbody>
                    <tr>
                      <td>Tổng tiền:</td>
                      <td><strong>{bookingResult.final_price?.toLocaleString('vi-VN')} đ</strong></td>
                    </tr>
                    <tr>
                      <td>Hoa hồng:</td>
                      <td>{bookingResult.commission_amount?.toLocaleString('vi-VN')} đ ({(bookingResult.applicable_commission_rate * 100).toFixed(0)}%)</td>
                    </tr>
                    <tr>
                      <td>Trạng thái:</td>
                      <td>{bookingResult.payment_status === 'pending' ? 'Chờ thanh toán' : bookingResult.payment_status}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="confirmation-actions">
              <button className="btn-primary btn-large" onClick={handleGoHome}>
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BRANCH MODAL */}
      {showBranchModal && (
        <div className="modal-overlay" onClick={() => setShowBranchModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chọn chi nhánh</h2>
              <button className="modal-close" onClick={() => setShowBranchModal(false)}>×</button>
            </div>

            {selectedService && (
              <div className="modal-selected-service">
                <div className="info-label">Dịch vụ:</div>
                <div>{selectedService.provider_service_name_vn}</div>
                <div className="info-sub">{selectedService.discounted_price?.toLocaleString('vi-VN')} đ</div>
              </div>
            )}

            <div className="modal-filters">
              <input
                type="text"
                placeholder="Tìm theo tên chi nhánh, địa chỉ..."
                value={branchSearchQuery}
                onChange={(e) => setBranchSearchQuery(e.target.value)}
                className="filter-search"
              />
              <div className="filter-row">
                <select 
                  value={selectedCity} 
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Tất cả thành phố</option>
                  {cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                <select 
                  value={selectedDistrict} 
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Tất cả quận</option>
                  {districts.map(district => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-body">
              <div className="branches-count">{filteredBranches.length} chi nhánh khả dụng</div>
              <div className="branches-list">
                {filteredBranches.map(branch => (
                  <div key={branch.id} className="branch-item">
                    <div className="branch-info">
                      <div className="branch-name">{branch.branch_name_vn}</div>
                      <div className="branch-address">{branch.address}</div>
                      <div className="branch-contact">{branch.notification_email || branch.phone}</div>
                      {branch.operating_hours?.hours_text && (
                        <div className="branch-hours">{branch.operating_hours.hours_text}</div>
                      )}
                    </div>
                    <button 
                      className="btn-primary"
                      onClick={() => handleSelectBranch(branch)}
                    >
                      Đặt lịch tại đây
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TIER SELECTOR MODAL */}
      {showTierModal && pendingService && (
        <div className="modal-overlay" onClick={() => setShowTierModal(false)}>
          <div className="modal-content tier-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chọn mức dịch vụ</h2>
              <button className="modal-close" onClick={() => setShowTierModal(false)}>×</button>
            </div>

            <div className="tier-service-info">
              <div className="tier-service-name">{pendingService.provider_service_name_vn}</div>
              <div className="tier-service-provider">{pendingService.providers?.brand_name_vn}</div>
            </div>

            <div className="tier-options">
              {pendingService.pricing_data.map((tier, index) => (
                <div
                  key={tier.tier || index}
                  className={`tier-option ${selectedTier?.tier === tier.tier ? 'tier-selected' : ''}`}
                  onClick={() => setSelectedTier(tier)}
                >
                  <div className="tier-header">
                    <span className="tier-label">{tier.label}</span>
                    {tier.is_default && <span className="tier-default-badge">Phổ biến</span>}
                  </div>
                  <div className="tier-price">{tier.price.toLocaleString('vi-VN')} đ</div>
                  {tier.features && tier.features.length > 0 && (
                    <ul className="tier-features">
                      {tier.features.map((feature, i) => (
                        <li key={i}>{feature}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="tier-actions">
              <button className="btn-secondary" onClick={() => setShowTierModal(false)}>
                Hủy
              </button>
              <button className="btn-primary" onClick={handleConfirmTier} disabled={!selectedTier}>
                Tiếp tục - {selectedTier?.price?.toLocaleString('vi-VN')} đ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING CART */}
      {testCart.length > 0 && (
        <>
          {showCart && (
            <div 
              className="cart-backdrop"
              onClick={() => setShowCart(false)}
            />
          )}

          <button
            className="cart-fab-mobile"
            onClick={() => setShowCart(true)}
            style={{ display: showCart ? 'none' : 'flex' }}
          >
            <span className="cart-fab-icon">🛒</span>
            <span className="cart-fab-badge">{testCart.length}</span>
          </button>

          <div className={`floating-cart ${showCart ? 'cart-open' : ''}`}>
            <div className="cart-header" onClick={() => setShowCart(!showCart)}>
              <div className="cart-header-left">
                <span className="cart-icon">🛒</span>
                <span className="cart-title">Giỏ xét nghiệm ({testCart.length})</span>
              </div>
              <div className="cart-header-right">
                <span className="cart-total">{cartTotal.toLocaleString('vi-VN')} đ</span>
                <span className="cart-toggle">{showCart ? '▼' : '▲'}</span>
              </div>
            </div>
            
            {showCart && (
              <div className="cart-body">
                <div className="cart-items">
                  {testCart.map((test, idx) => (
                    <div key={test.id} className="cart-item">
                      <span className="cart-item-number">{idx + 1}.</span>
                      <div className="cart-item-details">
                        <div className="cart-item-name">{test.provider_service_name_vn}</div>
                        <div className="cart-item-price">
                          {parseFloat(test.discounted_price).toLocaleString('vi-VN')} đ
                        </div>
                      </div>
                      <button 
                        className="cart-item-remove"
                        onClick={() => removeFromCart(test.id)}
                        title="Xóa khỏi giỏ"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="cart-summary">
                  <div className="cart-summary-row">
                    <span>Tổng cộng:</span>
                    <span className="cart-summary-total">{cartTotal.toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>
                
                <div className="cart-actions">
                  <button className="btn-cart-clear" onClick={clearCart}>
                    Xóa tất cả
                  </button>
                  <button className="btn-cart-book" onClick={handleBookCart}>
                    Chọn chi nhánh
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;