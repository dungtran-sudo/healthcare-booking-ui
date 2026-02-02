import React, { useState, useEffect, useCallback } from 'react';

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

function SmartSearch({ onSelectService }) {
  // State
  const [query, setQuery] = useState('');
  const [pathways, setPathways] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [selectedPathway, setSelectedPathway] = useState(null);
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dbReady, setDbReady] = useState(null);

  // Check database status on mount
  useEffect(() => {
    const checkDb = async () => {
      try {
        const response = await fetch(`${API_URL}/api/setup/status`);
        const data = await response.json();
        setDbReady(data.status?.ready || false);
      } catch (error) {
        console.error('Error checking DB status:', error);
        setDbReady(false);
      }
    };
    checkDb();
  }, []);

  // Fetch clinical pathways
  useEffect(() => {
    const fetchPathways = async () => {
      try {
        const response = await fetch(`${API_URL}/api/clinical-pathways`);
        const data = await response.json();
        if (data.success) {
          setPathways(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching pathways:', error);
      }
    };
    fetchPathways();
  }, []);

  // Perform smart search
  const performSmartSearch = useCallback(async (searchQuery, pathwayId = null) => {
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
      }
    } catch (error) {
      console.error('Smart search error:', error);
    }

    setLoading(false);
  }, [patientAge, patientGender]);

  // Handle pathway selection
  const handlePathwaySelect = (pathway) => {
    setSelectedPathway(pathway);
    setQuery(pathway.name_vn);
    performSmartSearch(null, pathway.id);
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

  // If database not ready, show setup instructions
  if (dbReady === false) {
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

  // Loading state for initial check
  if (dbReady === null) {
    return (
      <div className="smart-search-loading">
        <div className="loading-spinner" />
        <p>Đang kiểm tra...</p>
      </div>
    );
  }

  return (
    <div className="smart-search">
      {/* Header */}
      <div className="smart-search-header">
        <h2>Tìm kiếm thông minh</h2>
        <p className="smart-search-subtitle">
          Nhập triệu chứng hoặc tình trạng sức khỏe để tìm gói xét nghiệm phù hợp nhất
        </p>
      </div>

      {/* Search Input */}
      <div className="smart-search-input-section">
        <div className="smart-search-box">
          <input
            type="text"
            placeholder="Ví dụ: tiểu đường, mệt mỏi, đau ngực, khám tổng quát..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? 'Đang tìm...' : 'Tìm kiếm'}
          </button>
        </div>

        {/* Advanced filters toggle */}
        <button
          className="btn-text advanced-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? 'Ẩn bộ lọc' : 'Bộ lọc nâng cao'}
        </button>

        {showAdvanced && (
          <div className="advanced-filters">
            <div className="filter-group">
              <label>Tuổi bệnh nhân:</label>
              <input
                type="number"
                placeholder="VD: 45"
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
                min="1"
                max="120"
              />
            </div>
            <div className="filter-group">
              <label>Giới tính:</label>
              <select value={patientGender} onChange={(e) => setPatientGender(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Quick Pathway Buttons */}
      <div className="pathway-section">
        <h3>Hoặc chọn nhanh theo nhu cầu:</h3>

        {Object.entries(groupedPathways).map(([category, categoryPathways]) => (
          <div key={category} className="pathway-category">
            <div className="pathway-category-name">{category}</div>
            <div className="pathway-buttons">
              {categoryPathways.map(pathway => (
                <button
                  key={pathway.id}
                  className={`pathway-button ${selectedPathway?.id === pathway.id ? 'selected' : ''}`}
                  onClick={() => handlePathwaySelect(pathway)}
                >
                  <span className="pathway-name">{pathway.name_vn}</span>
                  {pathway.is_common && <span className="pathway-common-badge">Phổ biến</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
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
          {/* Suggested Pathway Info */}
          {searchResults.suggested_pathway && (
            <div className="suggested-pathway-info">
              <div className="pathway-info-header">
                <h3>{searchResults.suggested_pathway.name_vn}</h3>
                <span className="pathway-code">{searchResults.suggested_pathway.code}</span>
              </div>
              {searchResults.suggested_pathway.description && (
                <p className="pathway-description">{searchResults.suggested_pathway.description}</p>
              )}

              {/* Required Services */}
              {searchResults.suggested_pathway.required_services?.length > 0 && (
                <div className="pathway-services">
                  <h4>Xét nghiệm bắt buộc ({searchResults.suggested_pathway.required_services.length}):</h4>
                  <div className="service-tags required">
                    {searchResults.suggested_pathway.required_services.map(service => (
                      <span key={service.id} className="service-tag required">
                        {service.name_vn}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Services */}
              {searchResults.suggested_pathway.recommended_services?.length > 0 && (
                <div className="pathway-services">
                  <h4>Xét nghiệm khuyến nghị ({searchResults.suggested_pathway.recommended_services.length}):</h4>
                  <div className="service-tags recommended">
                    {searchResults.suggested_pathway.recommended_services.map(service => (
                      <span key={service.id} className="service-tag recommended">
                        {service.name_vn}
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
                <p className="section-description">Các gói bao gồm đầy đủ các xét nghiệm cần thiết</p>

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
                        Chọn gói này
                      </button>
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
                <p className="section-description">Các gói bao gồm một số xét nghiệm cần thiết</p>

                <div className="package-list">
                  {searchResults.results.partial_packages.map(pkg => (
                    <div key={pkg.provider_service_id} className="package-card partial">
                      <div className="package-header">
                        <div className="package-name">{pkg.name}</div>
                        <div className="package-provider">{pkg.provider?.brand_name_vn}</div>
                      </div>

                      <div className="package-coverage">
                        <CoverageBar score={pkg.coverage_score} label="Độ phủ" />
                      </div>

                      {pkg.missing_canonical_ids?.length > 0 && (
                        <div className="missing-services">
                          <span className="missing-label">Thiếu {pkg.missing_canonical_ids.length} xét nghiệm</span>
                        </div>
                      )}

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
                        Chọn gói này
                      </button>
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
                <p className="section-description">
                  Tổng chi phí nếu đặt từng xét nghiệm riêng lẻ
                </p>

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
                <p>Hãy thử tìm kiếm với từ khóa khác hoặc chọn một nhu cầu từ danh sách trên.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SmartSearch;
