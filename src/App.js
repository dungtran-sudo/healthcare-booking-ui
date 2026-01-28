import React, { useState } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL;

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [packages, setPackages] = useState([]);
  const [individualTests, setIndividualTests] = useState([]);
  const [showIndividualTests, setShowIndividualTests] = useState(false);
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



// Helper to remove accents
const removeAccents = (str) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

// NEW: Calculate relevance score
const calculateRelevance = (service, searchQuery) => {
  const query = removeAccents(searchQuery).trim();
  const name = removeAccents(service.provider_service_name_vn);
  const description = removeAccents(service.short_description || '');
  
  let score = 0;
  
  // Exact match in name
  if (name === query) {
    score += 100;
  }
  
  // Name starts with query
  else if (name.startsWith(query)) {
    score += 50;
  }
  
  // Query appears in name
  else if (name.includes(query)) {
    score += 30;
  }
  
  // Individual words match
  else {
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    queryWords.forEach(word => {
      if (name.includes(word)) {
        score += 15;
      }
      if (description.includes(word)) {
        score += 5;
      }
    });
  }
  
  // Boost for packages
  if (service.service_type === 'package') {
    score += 10;
  }
  
  // Penalty for very long names (less specific)
  if (name.length > 100) {
    score -= 5;
  }
  
  return score;
};

  // Search services
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
      const pkgs = data.data.filter(s => s.service_type === 'package');
      const tests = data.data.filter(s => s.service_type === 'individual_test');
      
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
    setShowIndividualTests(false);
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

            {/* PACKAGES SECTION */}
            {packages.length > 0 && (
              <div className="results-section">
                <h2>Gói dịch vụ ({packages.length})</h2>
                <div className="results-list">
                  {packages.map(pkg => (
                    <div key={pkg.id} className="result-card package-card">
                      <div className="result-header">
                        <div className="result-title">{pkg.provider_service_name_vn}</div>
                        <div className="result-meta">
                          <span className="provider-name">{pkg.providers?.brand_name_vn}</span>
                          <span className="price">{pkg.discounted_price?.toLocaleString('vi-VN')} đ</span>
                        </div>
                      </div>
                      
                      {pkg.highlighted_benefits && pkg.highlighted_benefits.length > 0 && (
                        <div className="benefits">
                          {pkg.highlighted_benefits.slice(0, 3).map((benefit, i) => (
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
                          className="btn-primary"
                          onClick={() => handleSelectService(pkg)}
                        >
                          Chọn chi nhánh
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
                </div>
              </div>
            )}

            {/* INDIVIDUAL TESTS SECTION */}
            {individualTests.length > 0 && (
              <div className="results-section individual-tests-section">
                <div className="individual-tests-header">
                  <h2>Xét nghiệm đơn lẻ ({individualTests.length})</h2>
                  <button 
                    className="btn-toggle"
                    onClick={() => setShowIndividualTests(!showIndividualTests)}
                  >
                    {showIndividualTests ? 'Ẩn' : 'Hiển thị'}
                  </button>
                </div>
                <div className="warning-box">
                  Khuyến nghị đặt gói để tiết kiệm chi phí
                </div>

                {showIndividualTests && (
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
                            <button 
                              className="btn-primary"
                              onClick={() => handleSelectService(test)}
                            >
                              Chọn chi nhánh
                            </button>
                          ) : (
                            <button className="btn-disabled" disabled>
                              Không thể đặt trực tuyến
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                    <tr>
                      <td>Tên dịch vụ:</td>
                      <td><strong>{selectedService.provider_service_name_vn}</strong></td>
                    </tr>
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
    </div>
  );
}

export default App;