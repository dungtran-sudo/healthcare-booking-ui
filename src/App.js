import React, { useState } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL;

function App() {
  const [activeTab, setActiveTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    patient_name: '',
    patient_phone: '',
    patient_email: '',
    appointment_date: '',
    appointment_time_slot: 'morning',
    patient_notes: ''
  });
  const [bookingResult, setBookingResult] = useState(null);

  // Search services
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/search/services?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      setSearchResults(data.data || []);
    } catch (error) {
      alert('Lỗi tìm kiếm: ' + error.message);
    }
    setLoading(false);
  };

  // Get branches for service
  const handleSelectService = async (service) => {
    setSelectedService(service);
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/services/${service.id}/branches`
      );
      const data = await response.json();
      setBranches(data.data || []);
    } catch (error) {
      alert('Lỗi tải chi nhánh: ' + error.message);
    }
    setLoading(false);
  };

  // Create booking
  const handleCreateBooking = async (e) => {
    e.preventDefault();
    
    if (!selectedService || branches.length === 0) {
      alert('Vui lòng chọn dịch vụ và chi nhánh');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_service_id: selectedService.id,
          branch_id: branches[0].id, // Using first branch for demo
          ...bookingForm,
          created_by_email: 'cs@hellobacsi.com'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setBookingResult(data.data);
        alert(`✅ Đặt lịch thành công! Mã: ${data.data.booking_reference}`);
        // Reset form
        setBookingForm({
          patient_name: '',
          patient_phone: '',
          patient_email: '',
          appointment_date: '',
          appointment_time_slot: 'morning',
          patient_notes: ''
        });
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (error) {
      alert('Lỗi tạo lịch hẹn: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="App">
      <header className="header">
        <h1>🏥 Hệ thống Đặt lịch Y tế</h1>
        <p>HelloHealth Booking System</p>
      </header>

      <div className="tabs">
        <button 
          className={activeTab === 'search' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('search')}
        >
          🔍 Tìm kiếm
        </button>
        <button 
          className={activeTab === 'booking' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('booking')}
        >
          📅 Đặt lịch
        </button>
      </div>

      <div className="container">
        {activeTab === 'search' && (
          <div className="search-section">
            <h2>Tìm kiếm dịch vụ</h2>
            
            <div className="search-box">
              <input
                type="text"
                placeholder="Nhập tên dịch vụ (ví dụ: xét nghiệm máu, siêu âm...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} disabled={loading}>
                {loading ? 'Đang tìm...' : 'Tìm kiếm'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="results">
                <h3>Kết quả ({searchResults.length} dịch vụ)</h3>
                {searchResults.map(service => (
                  <div key={service.id} className="result-card">
                    <div className="service-info">
                      <h4>{service.provider_service_name_vn}</h4>
                      <p className="provider">{service.providers?.brand_name_vn}</p>
                      <p className="description">{service.short_description}</p>
                      <div className="service-meta">
                        <span className="price">
                          {service.discounted_price?.toLocaleString('vi-VN')} đ
                        </span>
                        {service.home_sampling_available && (
                          <span className="badge">🏠 Lấy mẫu tại nhà</span>
                        )}
                      </div>
                    </div>
                    <button 
                      className="btn-select"
                      onClick={() => handleSelectService(service)}
                    >
                      Xem chi nhánh
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedService && (
              <div className="branches-section">
                <h3>Chi nhánh có dịch vụ: {selectedService.provider_service_name_vn}</h3>
                {loading ? (
                  <p>Đang tải...</p>
                ) : branches.length > 0 ? (
                  <div className="branches-list">
                    {branches.map(branch => (
                      <div key={branch.id} className="branch-card">
                        <h4>{branch.branch_name_vn}</h4>
                        <p>📍 {branch.address}</p>
                        <p>📞 {branch.phone || branch.notification_email}</p>
                        <p className="branch-price">
                          Giá: {(branch.service_price || selectedService.discounted_price)?.toLocaleString('vi-VN')} đ
                        </p>
                        <button 
                          className="btn-book"
                          onClick={() => {
                            setActiveTab('booking');
                            setSelectedService(selectedService);
                            setBranches([branch]);
                          }}
                        >
                          Đặt lịch tại đây
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>Không tìm thấy chi nhánh</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'booking' && (
          <div className="booking-section">
            <h2>Tạo lịch hẹn</h2>

            {selectedService ? (
              <>
                <div className="selected-service">
                  <h3>Dịch vụ đã chọn</h3>
                  <p><strong>{selectedService.provider_service_name_vn}</strong></p>
                  <p>Giá: {selectedService.discounted_price?.toLocaleString('vi-VN')} đ</p>
                  {branches.length > 0 && (
                    <p>Chi nhánh: {branches[0].branch_name_vn}</p>
                  )}
                </div>

                <form onSubmit={handleCreateBooking} className="booking-form">
                  <div className="form-group">
                    <label>Họ tên bệnh nhân *</label>
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

                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={bookingForm.patient_email}
                      onChange={(e) => setBookingForm({...bookingForm, patient_email: e.target.value})}
                      placeholder="email@example.com"
                    />
                  </div>

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

                  <div className="form-group">
                    <label>Ghi chú</label>
                    <textarea
                      value={bookingForm.patient_notes}
                      onChange={(e) => setBookingForm({...bookingForm, patient_notes: e.target.value})}
                      placeholder="Ghi chú về tình trạng sức khỏe, yêu cầu đặc biệt..."
                      rows="3"
                    />
                  </div>

                  <button type="submit" className="btn-submit" disabled={loading}>
                    {loading ? 'Đang xử lý...' : '✅ Xác nhận đặt lịch'}
                  </button>
                </form>

                {bookingResult && (
                  <div className="booking-success">
                    <h3>✅ Đặt lịch thành công!</h3>
                    <p><strong>Mã đặt lịch:</strong> {bookingResult.booking_reference}</p>
                    <p><strong>Bệnh nhân:</strong> {bookingResult.patient_name}</p>
                    <p><strong>Ngày hẹn:</strong> {bookingResult.appointment_date}</p>
                    <p><strong>Tổng tiền:</strong> {bookingResult.final_price?.toLocaleString('vi-VN')} đ</p>
                    <p><strong>Hoa hồng:</strong> {bookingResult.commission_amount?.toLocaleString('vi-VN')} đ</p>
                  </div>
                )}
              </>
            ) : (
              <div className="no-service">
                <p>Vui lòng tìm kiếm và chọn dịch vụ trước</p>
                <button onClick={() => setActiveTab('search')}>
                  🔍 Quay lại tìm kiếm
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="footer">
        <p>© 2026 HelloHealth - Healthcare Booking System</p>
        <p>API: {API_URL}</p>
      </footer>
    </div>
  );
}

export default App;