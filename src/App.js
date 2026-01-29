import React, { useState } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL;

function App() {
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
  const [currentView, setCurrentView] = useState('search'); // 'search', 'booking', 'confirmation'
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
  const [showAllPackages, setShowAllPackages] = useState(false); 
  const [testCart, setTestCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [activeTab, setActiveTab] = useState('packages'); // ADD THIS




// Helper to remove accents
const removeAccents = (str) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

// NEW: Add this function AFTER removeAccents
// Calculate relevance score
const calculateRelevance = (service, searchQuery) => {
  const query = removeAccents(searchQuery).trim();
  const name = removeAccents(service.provider_service_name_vn);
  const description = removeAccents(service.short_description || '');
  const queryWords = query.split(/\s+/).filter(w => w.length > 2);
  
  let score = 0;
  
  // Check if ALL query words are present (required for relevance)
  const allWordsInName = queryWords.every(word => name.includes(word));
  const allWordsInDescription = queryWords.every(word => description.includes(word));
  
  // If search words don't match at all, score should be very low
  if (!allWordsInName && !allWordsInDescription) {
    // Check if at least SOME words match
    const someWordsMatch = queryWords.some(word => name.includes(word) || description.includes(word));
    if (!someWordsMatch) {
      return 0; // No match at all
    }
    // Partial match - very low score
    return 5;
  }
  
  // Exact match in name (highest priority)
  if (name === query) {
    score += 100;
  }
  
  // Name starts with query
  else if (name.startsWith(query)) {
    score += 80;
  }
  
  // All words appear together in name (phrase match)
  else if (name.includes(query)) {
    score += 60;
  }
  
  // All individual words in name (scattered)
  else if (allWordsInName) {
    score += 40;
    // Bonus if words appear close together
    const firstWordIndex = name.indexOf(queryWords[0]);
    const lastWordIndex = name.indexOf(queryWords[queryWords.length - 1]);
    const distance = lastWordIndex - firstWordIndex;
    if (distance < 20) score += 10; // Words are close together
  }
  
  // All words in description but not name
  else if (allWordsInDescription) {
    score += 20;
  }
  
  // Boost for packages
  if (service.service_type === 'package') {
    score += 10;
  }
  
  // Bonus for exact word boundaries (not substring matches)
  queryWords.forEach(word => {
    const wordBoundaryRegex = new RegExp(`\\b${word}\\b`);
    if (wordBoundaryRegex.test(name)) {
      score += 5;
    }
  });
  
  // Penalty for very long names (less specific)
  if (name.length > 100) {
    score -= 5;
  }
  
  return score;
};

// NEW: Cart management functions
const addToCart = (test) => {
  if (testCart.find(t => t.id === test.id)) {
    alert('Xét nghiệm này đã có trong giỏ');
    return;
  }
  setTestCart([...testCart, test]);
  setShowCart(true);
};

const removeFromCart = (testId) => {
  setTestCart(testCart.filter(t => t.id !== testId));
  if (testCart.length <= 1) {
    setShowCart(false);
  }
};

const clearCart = () => {
  if (window.confirm('Xóa tất cả xét nghiệm trong giỏ?')) {
    setTestCart([]);
    setShowCart(false);
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
  
  // Create a virtual service object for cart
  const cartService = {
    id: 'cart',
    provider_service_name_vn: `${testCart.length} xét nghiệm đơn lẻ`,
    discounted_price: cartTotal,
    service_type: 'custom_bundle',
    providers: testCart[0].providers,
    cart_items: testCart
  };
  
  setSelectedService(cartService);
  setLoading(true);
  
  try {
    // Get branches that offer ALL tests in cart
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
    
    // Filter branches that have ALL tests
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

// Search services (MODIFY THIS EXISTING FUNCTION)
const handleSearch = async () => {
  if (!searchQuery.trim()) return;
  
  setLoading(true);
  try {
    const normalizedQuery = removeAccents(searchQuery);
    const response = await fetch(
      `${API_URL}/api/search/services?q=${encodeURIComponent(normalizedQuery)}`
    );
    const data = await response.json();
    
    // Separate packages and individual tests
    let pkgs = data.data.filter(s => s.service_type === 'package');
    let tests = data.data.filter(s => s.service_type === 'individual_test');
    
    // NEW: Sort by relevance
    pkgs = pkgs.map(pkg => ({
      ...pkg,
      relevanceScore: calculateRelevance(pkg, searchQuery)
    })).sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    tests = tests.map(test => ({
      ...test,
      relevanceScore: calculateRelevance(test, searchQuery)
    })).sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    setPackages(pkgs);
    setIndividualTests(tests);
  } catch (error) {
    alert('Lỗi tìm kiếm: ' + error.message);
  }
  setLoading(false);
};

  // Get package components
  const loadPackageComponents = async (packageId) => {
    if (packageComponents[packageId]) {
      // Already loaded
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
    setSelectedService(service);
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
      const response = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_service_id: selectedService.id,
          branch_id: selectedBranch.id,
          ...bookingForm,
          created_by_email: 'cs@hellobacsi.com'
        })
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
  };

  return (
    <div className="App">
      <header className="header">
        <h1>Hệ thống Đặt lịch Y tế</h1>
        <div className="header-subtitle">HelloHealth Booking System</div>
      </header>

      {/* SEARCH VIEW */}
      {currentView === 'search' && (
        <div className="container">
          <div className="search-section">
            <div className="search-box">
              <input
                type="text"
                placeholder="Tìm theo tên dịch vụ, gói xét nghiệm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                autoFocus
              />
              <button onClick={handleSearch} disabled={loading}>
                {loading ? 'Đang tìm...' : 'Tìm kiếm'}
              </button>
            </div>

{/* SEARCH RESULTS WITH TABS */}
{(packages.length > 0 || individualTests.length > 0) && (
  <div className="results-section">
    {/* Tabs */}
    <div className="results-tabs">
      <button
        className={`tab-button ${activeTab === 'packages' ? 'active' : ''}`}
        onClick={() => setActiveTab('packages')}
      >
        <span className="tab-icon">Gói</span>
        <span className="tab-count">({packages.length})</span>
      </button>
      <button
        className={`tab-button ${activeTab === 'tests' ? 'active' : ''}`}
        onClick={() => setActiveTab('tests')}
      >
        <span className="tab-icon">Dịch vụ lẻ</span>
        <span className="tab-count">({individualTests.length})</span>
      </button>
    </div>

    {/* Tab Content */}
    <div className="tab-content">
      {/* PACKAGES TAB */}
      {activeTab === 'packages' && packages.length > 0 && (
        <div className="packages-tab">
          <div className="results-list">
            {packages.slice(0, showAllPackages ? packages.length : 3).map((pkg, index) => (
              <div key={pkg.id} className="result-card package-card">
                {index === 0 && (
                  <div className="recommended-badge">KHUYẾN NGHỊ</div>
                )}
                
                <div className="result-header">
                  <div className="result-title">{pkg.provider_service_name_vn}</div>
                  <div className="result-meta">
                    <span className="provider-name">{pkg.providers?.brand_name_vn}</span>
                    <span className="price">{pkg.discounted_price?.toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>

                {/* Suitable For Section */}
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

                {/* Key Benefits */}
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

                {/* Package components expansion */}
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

            {/* Show More button */}
            {packages.length > 3 && (
              <div className="show-more-section">
                <button 
                  className="btn-show-more"
                  onClick={() => setShowAllPackages(!showAllPackages)}
                >
                  {showAllPackages 
                    ? 'Thu gọn' 
                    : `Xem thêm ${packages.length - 3} gói khác`
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TESTS TAB */}
      {activeTab === 'tests' && individualTests.length > 0 && (
        <div className="tests-tab">
          <div className="warning-box">
            ⚠️ Khuyến nghị đặt gói để tiết kiệm chi phí
          </div>

          <div className="results-list">
            {individualTests.map(test => (
              <div key={test.id} className="result-card test-card">
                <div className="result-header">
                  <div className="result-title">{test.provider_service_name_vn}</div>
                  <div className="result-meta">
                    <span className="provider-name">{test.providers?.brand_name_vn}</span>
                    {test.discounted_price ? (
                      <span className="price">{test.discounted_price?.toLocaleString('vi-VN')} đ</span>
                    ) : (
                      <span className="price-unavailable">Liên hệ</span>
                    )}
                  </div>
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
        </div>
      )}

      {/* Empty state */}
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
                <div className="info-sub">{selectedService.providers?.brand_name_vn} • {selectedService.discounted_price?.toLocaleString('vi-VN')} đ</div>
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

      {/* NEW: FLOATING CART */}
{/* FLOATING CART WITH MOBILE FAB */}
{testCart.length > 0 && (
  <>
    {/* Backdrop - only show when cart is OPEN on mobile */}
    {showCart && (
      <div 
        className="cart-backdrop"
        onClick={() => setShowCart(false)}
      />
    )}

    {/* Mobile FAB - only show when cart is CLOSED */}
    <button
      className="cart-fab-mobile"
      onClick={() => setShowCart(true)}
      style={{ display: showCart ? 'none' : 'flex' }}
    >
      <span className="cart-fab-icon">🛒</span>
      <span className="cart-fab-badge">{testCart.length}</span>
    </button>

    {/* Main cart */}
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
            <button className="btn-secondary btn-cart-clear" onClick={clearCart}>
              Xóa tất cả
            </button>
            <button className="btn-primary btn-cart-book" onClick={handleBookCart}>
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
