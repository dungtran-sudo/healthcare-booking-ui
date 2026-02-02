import React, { useState, useCallback } from 'react';
import { useCache } from './CacheContext';
import { getCachedSearch, cacheSearchResult } from './cache';

const API_URL = process.env.REACT_APP_API_URL;

// Coverage score visual component
const CoverageBar = ({ score, label }) => {
  const percentage = Math.round(score * 100);
  let colorClass = 'coverage-low';
  if (percentage >= 90) colorClass = 'coverage-high';
  else if (percentage >= 70) colorClass = 'coverage-medium';

  return (
    <div className="coverage-bar-container">
      {label && <span className="coverage-label">{label}</span>}
      <div className="coverage-bar">
        <div
          className={`coverage-fill ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="coverage-percent">{percentage}%</span>
    </div>
  );
};

// Category name mapping for Vietnamese display
const categoryNames = {
  'metabolic': 'Chuyển hóa',
  'cardiac': 'Tim mạch',
  'hepatic': 'Gan',
  'renal': 'Thận',
  'thyroid': 'Tuyến giáp',
  'annual': 'Khám định kỳ',
  'surgical': 'Phẫu thuật',
  'hematology': 'Huyết học',
  'infectious': 'Truyền nhiễm',
  'reproductive': 'Sinh sản',
  'bone': 'Xương khớp',
  'Khác': 'Khác'
};

function SmartSearch({ onSelectService }) {
  // Get cached data
  const { pathways: cachedPathways, isReady: cacheReady, isLoading: cacheLoading } = useCache();

  // State
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [selectedPathway, setSelectedPathway] = useState(null);
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPathwayModal, setShowPathwayModal] = useState(false);

  // Use cached pathways
  const pathways = cachedPathways || [];

  // Perform smart search with caching
  const performSmartSearch = useCallback(async (searchQuery, pathwayId = null) => {
    // Create cache key
    const cacheKey = pathwayId
      ? `pathway:${pathwayId}:${patientAge}:${patientGender}`
      : `query:${searchQuery}:${patientAge}:${patientGender}`;

    // Check cache first
    const cached = getCachedSearch(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
      console.log('Using cached search result');
      setSearchResults(cached.result);
      if (cached.result.suggested_pathway) {
        setSelectedPathway(cached.result.suggested_pathway);
      }
      return;
    }

    setLoading(true);
    setSearchResults(null);

    try {
      const body = {};

      if (pathwayId) {
        body.pathway_id = pathwayId;
      } else if (searchQuery) {
        body.query = searchQuery;
      }

      if (patientAge) body.patient_age = parseInt(patientAge);
      if (patientGender) body.patient_gender = patientGender;

      const response = await fetch(`${API_URL}/api/smart-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.success) {
        setSearchResults(data);
        if (data.suggested_pathway) {
          setSelectedPathway(data.suggested_pathway);
        }
        // Cache the result
        cacheSearchResult(cacheKey, data);
      }
    } catch (error) {
      console.error('Smart search error:', error);
    }

    setLoading(false);
  }, [patientAge, patientGender]);

  // Handle pathway selection from modal
  const handlePathwaySelect = (pathway) => {
    setSelectedPathway(pathway);
    setQuery(pathway.name_vn);
    setShowPathwayModal(false);
    performSmartSearch(null, pathway.id);
  };

  // Clear selected pathway
  const handleClearPathway = () => {
    setSelectedPathway(null);
    setQuery('');
    setSearchResults(null);
  };

  // Handle free text search
  const handleSearch = () => {
    if (query.trim()) {
      performSmartSearch(query);
    }
  };

  // Group pathways by category
  const groupedPathways = pathways.reduce((acc, pathway) => {
    const category = pathway.category || 'Khác';
    if (!acc[category]) acc[category] = [];
    acc[category].push(pathway);
    return acc;
  }, {});

  // Loading state while cache initializes
  if (cacheLoading) {
    return (
      <div className="smart-search-loading">
        <div className="loading-spinner" />
        <p>Đang tải dữ liệu...</p>
      </div>
    );
  }

  // If no pathways loaded, show setup instructions
  if (!cacheReady || pathways.length === 0) {
    return (
      <div className="smart-search-setup">
        <div className="setup-notice">
          <h3>Smart Search - Cần thiết lập</h3>
          <p>Tính năng Smart Search cần thiết lập cơ sở dữ liệu.</p>
          <div className="setup-steps">
            <h4>Các bước thiết lập:</h4>
            <ol>
              <li>
                Chạy SQL trong Supabase SQL Editor:
                <code>migrations/001_create_canonical_tables.sql</code>
              </li>
              <li>
                Chạy lệnh seed dữ liệu:
                <code>python3 scripts/seed_canonical_services.py</code>
              </li>
              <li>
                Chạy lệnh seed pathways:
                <code>python3 scripts/seed_clinical_pathways.py</code>
              </li>
              <li>
                Tự động mapping:
                <code>python3 scripts/auto_map_services.py</code>
              </li>
            </ol>
          </div>
          <button
            className="btn-primary"
            onClick={() => window.location.reload()}
          >
            Kiểm tra lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="smart-search">
      {/* Compact Search Section */}
      <div className="smart-search-compact">
        <div className="smart-search-row">
          {/* Search Input */}
          <div className="smart-search-input">
            <input
              type="text"
              placeholder="Nhập triệu chứng: tiểu đường, mệt mỏi, đau ngực..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Pathway Selector Button */}
          <button
            className="btn-pathway-select"
            onClick={() => setShowPathwayModal(true)}
          >
            <span className="btn-icon">📋</span>
            <span className="btn-label">Chọn nhu cầu</span>
          </button>

          {/* Search Button */}
          <button
            className="btn-primary btn-search"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
          >
            {loading ? 'Đang tìm...' : 'Tìm'}
          </button>
        </div>

        {/* Selected Pathway Chip + Advanced Filters (inline) */}
        <div className="smart-search-meta">
          {selectedPathway && (
            <div className="selected-pathway-chip">
              <span className="chip-label">{selectedPathway.name_vn}</span>
              <button className="chip-remove" onClick={handleClearPathway}>×</button>
            </div>
          )}

          <button
            className="btn-text advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Ẩn bộ lọc' : 'Bộ lọc'}
          </button>

          {showAdvanced && (
            <div className="inline-filters">
              <input
                type="number"
                placeholder="Tuổi"
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
                min="1"
                max="120"
                className="filter-input-small"
              />
              <select
                value={patientGender}
                onChange={(e) => setPatientGender(e.target.value)}
                className="filter-select-small"
              >
                <option value="">Giới tính</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Search Results */}
      {loading && (
        <div className="smart-search-loading">
          <div className="loading-spinner" />
          <p>Đang tìm kiếm gói phù hợp nhất...</p>
        </div>
      )}

      {searchResults && !loading && (
        <div className="smart-search-results">
          {/* Suggested Pathway Info - Compact */}
          {searchResults.suggested_pathway && (
            <div className="suggested-pathway-compact">
              <div className="pathway-info-row">
                <h3>{searchResults.suggested_pathway.name_vn}</h3>
                <span className="pathway-code">{searchResults.suggested_pathway.code}</span>
              </div>

              <div className="pathway-tests-row">
                {searchResults.suggested_pathway.required_services?.length > 0 && (
                  <div className="tests-group">
                    <span className="tests-label">Bắt buộc:</span>
                    <div className="tests-tags">
                      {searchResults.suggested_pathway.required_services.map(service => (
                        <span key={service.id} className="test-tag required">
                          {service.name_vn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {searchResults.suggested_pathway.recommended_services?.length > 0 && (
                  <div className="tests-group">
                    <span className="tests-label">Khuyến nghị:</span>
                    <div className="tests-tags">
                      {searchResults.suggested_pathway.recommended_services.map(service => (
                        <span key={service.id} className="test-tag recommended">
                          {service.name_vn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results Sections */}
          <div className="results-comparison">
            {/* Complete Packages */}
            {searchResults.results?.complete_packages?.length > 0 && (
              <div className="results-section complete-packages">
                <h3>
                  <span className="section-icon">✅</span>
                  Gói hoàn chỉnh ({searchResults.results.complete_packages.length})
                </h3>

                <div className="package-list">
                  {searchResults.results.complete_packages.map((pkg, index) => (
                    <div key={pkg.provider_service_id} className={`package-card complete ${index === 0 ? 'best-match' : ''}`}>
                      {index === 0 && <div className="best-match-badge">KHUYẾN NGHỊ</div>}

                      <div className="package-header">
                        <div className="package-name">{pkg.name}</div>
                        <div className="package-provider">{pkg.provider?.brand_name_vn}</div>
                      </div>

                      <div className="package-coverage">
                        <CoverageBar score={pkg.coverage_score} label="Độ phủ" />
                        <div className="coverage-details">
                          <span className="matched-count">
                            {pkg.matched_required}/{pkg.total_required} bắt buộc
                          </span>
                          {pkg.matched_recommended > 0 && (
                            <span className="matched-count recommended">
                              +{pkg.matched_recommended} khuyến nghị
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="package-footer">
                        <div className="package-price">
                          {pkg.price?.toLocaleString('vi-VN')} đ
                        </div>
                        <button
                          className="btn-primary btn-select-package"
                          onClick={() => onSelectService && onSelectService({
                            id: pkg.provider_service_id,
                            provider_service_name_vn: pkg.name,
                            discounted_price: pkg.price,
                            providers: pkg.provider,
                            service_type: 'package',
                            pricing_data: pkg.pricing_data
                          })}
                        >
                          Chọn
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Partial Packages */}
            {searchResults.results?.partial_packages?.length > 0 && (
              <div className="results-section partial-packages">
                <h3>
                  <span className="section-icon">📦</span>
                  Gói một phần ({searchResults.results.partial_packages.length})
                </h3>

                <div className="package-list">
                  {searchResults.results.partial_packages.map(pkg => (
                    <div key={pkg.provider_service_id} className="package-card partial">
                      <div className="package-header">
                        <div className="package-name">{pkg.name}</div>
                        <div className="package-provider">{pkg.provider?.brand_name_vn}</div>
                      </div>

                      <div className="package-coverage">
                        <CoverageBar score={pkg.coverage_score} label="Độ phủ" />
                        {pkg.missing_canonical_ids?.length > 0 && (
                          <span className="missing-label">Thiếu {pkg.missing_canonical_ids.length} xét nghiệm</span>
                        )}
                      </div>

                      <div className="package-footer">
                        <div className="package-price">
                          {pkg.price?.toLocaleString('vi-VN')} đ
                        </div>
                        <button
                          className="btn-secondary btn-select-package"
                          onClick={() => onSelectService && onSelectService({
                            id: pkg.provider_service_id,
                            provider_service_name_vn: pkg.name,
                            discounted_price: pkg.price,
                            providers: pkg.provider,
                            service_type: 'package'
                          })}
                        >
                          Chọn
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Individual Options */}
            {searchResults.results?.individual_options && (
              <div className="results-section individual-options">
                <h3>
                  <span className="section-icon">🔬</span>
                  Đặt lẻ từng xét nghiệm
                </h3>

                <div className="individual-summary">
                  <div className="individual-total">
                    <span className="total-label">Tổng cộng:</span>
                    <span className="total-price">
                      {searchResults.results.individual_options.total_price?.toLocaleString('vi-VN')} đ
                    </span>
                  </div>

                  <div className="individual-list">
                    {searchResults.results.individual_options.services.map(item => (
                      <div key={item.canonical_id} className="individual-item">
                        <div className="individual-item-info">
                          <span className="canonical-name">
                            {item.canonical_service?.name_vn}
                          </span>
                          <span className="provider-service-name">
                            {item.provider_service?.provider_service_name_vn}
                          </span>
                        </div>
                        <span className="individual-item-price">
                          {item.price?.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* No Results */}
            {!searchResults.results?.complete_packages?.length &&
             !searchResults.results?.partial_packages?.length &&
             !searchResults.results?.individual_options && (
              <div className="no-results">
                <p>Không tìm thấy gói xét nghiệm phù hợp.</p>
                <p>Hãy thử từ khóa khác hoặc chọn nhu cầu từ danh sách.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pathway Selection Modal */}
      {showPathwayModal && (
        <div className="modal-overlay" onClick={() => setShowPathwayModal(false)}>
          <div className="modal-content pathway-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chọn nhu cầu khám</h2>
              <button className="modal-close" onClick={() => setShowPathwayModal(false)}>×</button>
            </div>

            <div className="modal-body pathway-modal-body">
              {Object.entries(groupedPathways).map(([category, categoryPathways]) => (
                <div key={category} className="pathway-modal-category">
                  <div className="pathway-modal-category-name">
                    {categoryNames[category] || category}
                  </div>
                  <div className="pathway-modal-list">
                    {categoryPathways.map(pathway => (
                      <button
                        key={pathway.id}
                        className={`pathway-modal-item ${selectedPathway?.id === pathway.id ? 'selected' : ''}`}
                        onClick={() => handlePathwaySelect(pathway)}
                      >
                        <div className="pathway-modal-item-main">
                          <span className="pathway-modal-item-name">{pathway.name_vn}</span>
                          {pathway.is_common && <span className="pathway-common-badge">Phổ biến</span>}
                        </div>
                        <div className="pathway-modal-item-sub">
                          {pathway.required_services?.length || 0} xét nghiệm bắt buộc
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SmartSearch;
