import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, TrendingUp, TrendingDown, Settings, LogOut, Award, Clock, Download, Image as ImageIcon, Crown } from 'lucide-react';
import html2canvas from 'html2canvas';
import EpicLeaderboard from './EpicLeaderboard';
import './index.css';

const API_BASE_URL = '/api/bot-api/bots?_end=1000&_start=0&status=RUNNING,PENDING_STOP';
const REFRESH_INTERVAL_MS = 5000; // Auto update every 5 seconds

const getInvestorIdFromToken = (t) => {
  if (!t) return '1000066393';
  try {
    const payload = JSON.parse(atob(t.split('.')[1]));
    return payload.investorId || payload.accountNo || payload.userId || payload.sub || '1000066393';
  } catch (e) {
    return '1000066393';
  }
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('entrade_token') || '');
  const [isSetup, setIsSetup] = useState(!!localStorage.getItem('entrade_token'));
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState('day'); // day, week, month, year
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const intervalRef = useRef(null);
  const epicLeaderboardRef = useRef(null);

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError('');
    try {
      const invId = getInvestorIdFromToken(token);
      const url = `${API_BASE_URL}&investorId=${invId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': token.startsWith('Bearer') ? token : `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        if (response.status === 401) {
          throw new Error('Token hết hạn hoặc không hợp lệ. Vui lòng đăng xuất và đăng nhập lại.');
        }
        throw new Error(`Lỗi ${response.status} từ máy chủ: ${errText.substring(0, 100)}`);
      }
      
      const json = await response.json();
      const loadedBots = json.data || [];
      setBots(loadedBots);
      
      setLastUpdated(new Date());
    } catch (err) {
      if (!isBackground) setError(err.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    if (isSetup && token) {
      fetchData(); // Initial fetch
      
      // Real-time polling
      intervalRef.current = setInterval(() => {
        fetchData(true);
      }, REFRESH_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSetup, token]);

  // Đặt chiến lược mặc định khi danh sách bot đã tải mà chưa có strategy nào được chọn
  useEffect(() => {
    if (bots.length > 0 && !selectedStrategy) {
      setSelectedStrategy(bots[0].strategyName);
    }
  }, [bots, selectedStrategy]);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Vui lòng nhập tài khoản và mật khẩu');
      return;
    }
    setLoginLoading(true);
    setError('');
    try {
      const res = await fetch('/api/entrade-api/v2/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Đăng nhập thất bại. Kiểm tra lại thông tin.');
      }
      
      // In ra console để debug
      console.log('Phản hồi từ Entrade:', data);
      
      // Token usually in data.token, data.data.token, or access_token
      const tokenToSave = data.token || data.data?.token || data.access_token;
      if (!tokenToSave || typeof tokenToSave !== 'string') {
        throw new Error('Không lấy được Token hợp lệ. Dữ liệu: ' + JSON.stringify(data).substring(0, 150));
      }
      
      localStorage.setItem('entrade_token', tokenToSave);
      setToken(tokenToSave);
      setIsSetup(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('entrade_token');
    setToken('');
    setUsername('');
    setPassword('');
    setIsSetup(false);
    setBots([]);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const exportLeaderboard = async () => {
    if (!epicLeaderboardRef.current) return;
    try {
      // Manual cloning to bypass any viewport clipping or hidden wrapper bugs
      const originalNode = epicLeaderboardRef.current;
      const clone = originalNode.cloneNode(true);
      
      // Force exact dimensions and visibility on the clone
      clone.style.position = 'absolute';
      clone.style.top = '0px';
      clone.style.left = '0px';
      clone.style.width = '1200px';
      clone.style.zIndex = '-9999';
      clone.style.opacity = '1';
      clone.style.pointerEvents = 'none';
      
      // Temporarily expand body to prevent scrollbar/clipping issues during capture
      const oldOverflow = document.body.style.overflow;
      document.body.style.overflow = 'visible';
      
      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, {
        backgroundColor: '#ffffff',
        scale: 2, // Tăng độ nét cho ảnh xuất ra
        width: 1200,
        windowWidth: 1200,
        scrollX: 0,
        scrollY: 0
      });
      
      document.body.removeChild(clone);
      document.body.style.overflow = oldOverflow;

      const link = document.createElement('a');
      link.download = `BXH_Bot_Entrade_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (err) {
      console.error('Lỗi khi xuất ảnh:', err);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  // Tính PnL của 1 bot dựa trên khoảng thời gian
  const getProfitByTimeframe = (bot, timeframe) => {
    if (!bot.results || !bot.results.deals) return 0;
    
    const now = new Date();
    // Bắt đầu ngày hôm nay
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Bắt đầu tuần này (Thứ 2)
    const dayOfWeek = now.getDay() || 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1);
    
    // Bắt đầu tháng này
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Bắt đầu năm nay
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    let targetStartDate;
    if (timeframe === 'day') targetStartDate = startOfToday;
    else if (timeframe === 'week') targetStartDate = startOfWeek;
    else if (timeframe === 'month') targetStartDate = startOfMonth;
    else if (timeframe === 'year') targetStartDate = startOfYear;
    
    let profit = 0;
    bot.results.deals.forEach(deal => {
      // deal.closeTime là chuẩn ISO UTC
      if (deal.closeTime && !deal.closeTime.startsWith("0001")) {
        const dealDate = new Date(deal.closeTime);
        if (dealDate >= targetStartDate) {
          profit += (deal.netProfit || 0);
        }
      }
    });
    return profit;
  };

  if (!isSetup) {
    return (
      <div className="setup-container">
        <div className="card setup-card" style={{ padding: '40px 32px' }}>
          <Settings size={48} color="var(--accent-color)" style={{ marginBottom: 16 }} />
          <h2>Đăng nhập Entrade</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, marginBottom: 24 }}>
            Vui lòng đăng nhập tài khoản DNSE / Entrade để bắt đầu theo dõi Bot.
          </p>
          <div style={{ textAlign: 'left', marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Tài khoản / Số điện thoại</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Nhập tên đăng nhập"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ marginTop: 8, fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ textAlign: 'left', marginBottom: 24 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Mật khẩu</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              style={{ marginTop: 8, fontFamily: 'inherit' }}
            />
          </div>
          {error && <p className="text-red" style={{ marginBottom: 16 }}>{error}</p>}
          <button 
            className="btn-primary" 
            onClick={handleLogin} 
            disabled={loginLoading}
            style={{ width: '100%', padding: '12px', fontSize: 16, opacity: loginLoading ? 0.7 : 1 }}
          >
            {loginLoading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </div>
      </div>
    );
  }

  const totalPnL = bots.reduce((sum, bot) => sum + (bot.results?.profit || 0), 0);
  const totalBots = bots.length;
  const runningBots = bots.filter(b => b.status === 'RUNNING').length;

  // Tính toán bảng xếp hạng theo thời gian
  const leaderboard = [...bots].map(bot => ({
    ...bot,
    todayProfit: getProfitByTimeframe(bot, leaderboardTimeframe)
  })).sort((a, b) => b.todayProfit - a.todayProfit);

  // Lấy danh sách các chiến lược độc nhất để làm menu chọn
  const uniqueStrategies = useMemo(() => {
    const names = bots.map(b => b.strategyName);
    return [...new Set(names)];
  }, [bots]);

  // Xử lý dữ liệu cho biểu đồ: gom các bot có cùng tên chiến lược (Long & Short)
  const chartData = useMemo(() => {
    if (!selectedStrategy) return [];
    
    const botsOfStrategy = bots.filter(b => b.strategyName === selectedStrategy);
    const timeMap = {};
    
    // Sử dụng thuật toán Time Bucket (gom nhóm mỗi 10 phút) để chống nhảy biểu đồ
    const BUCKET_SIZE_MS = 10 * 60 * 1000; 

    botsOfStrategy.forEach(bot => {
      if (!bot.results || !bot.results.assets) return;
      
      bot.results.assets.forEach(a => {
        if (!a.time || a.time.startsWith('000') || a.time.startsWith('0001')) return; // Bỏ qua dữ liệu lỗi
        
        const d = new Date(a.time);
        const ms = d.getTime();
        // Làm tròn mốc thời gian về bucket 10 phút cố định
        const bucketMs = Math.floor(ms / BUCKET_SIZE_MS) * BUCKET_SIZE_MS;
        
        if (!timeMap[bucketMs]) {
          timeMap[bucketMs] = {
            ms: bucketMs,
            timeLabel: new Date(bucketMs).toLocaleString('vi-VN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          };
        }
        // Ghi lại NAV cho botType tương ứng (LONG hoặc SHORT). Nếu có nhiều điểm trong 10 phút, nó sẽ lấy điểm cuối cùng.
        timeMap[bucketMs][bot.botType] = a.nav;
      });
    });

    // Chuyển object thành array và sắp xếp theo thời gian
    // BỎ HẲN DECIMATION để biểu đồ không bao giờ bị nhảy. Time Bucket 10 phút đã đủ giới hạn dữ liệu ở mức mượt mà (~140 điểm/ngày)
    return Object.values(timeMap).sort((a, b) => a.ms - b.ms);
  }, [bots, selectedStrategy]);

  // Các botType đang có trong chiến lược đang chọn để vẽ Line tương ứng
  const availableBotTypes = useMemo(() => {
    const types = new Set();
    chartData.forEach(d => {
      if (d.LONG !== undefined) types.add('LONG');
      if (d.SHORT !== undefined) types.add('SHORT');
    });
    return Array.from(types);
  }, [chartData]);

  return (
    <div className="container">
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Activity size={32} color="var(--accent-color)" />
          <h1 className="title">Entrade Bot Dashboard</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {lastUpdated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
              <Clock size={14} /> 
              Cập nhật: {lastUpdated.toLocaleTimeString('vi-VN')}
            </div>
          )}
          <button onClick={handleLogout} style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 6 }}>
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </div>

      {loading && !bots.length ? (
        <p>Đang tải dữ liệu...</p>
      ) : error && !bots.length ? (
        <div className="card"><p className="text-red">{error}</p></div>
      ) : (
        <>
          <div className="grid-3">
            <div className="card">
              <div className="metric-title">Tổng Lãi/Lỗ Tất Cả Bot</div>
              <div className={`metric-value ${totalPnL >= 0 ? 'text-green' : 'text-red'}`}>
                {formatCurrency(totalPnL)}
              </div>
            </div>
            <div className="card">
              <div className="metric-title">Số lượng Bot</div>
              <div className="metric-value">{totalBots}</div>
            </div>
            <div className="card">
              <div className="metric-title">Đang chạy (Running)</div>
              <div className="metric-value text-green">{runningBots}</div>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            {/* Bảng Bot Đang Triển Khai */}
            <div className="card">
              <h2 style={{ fontSize: 18, marginBottom: 16 }}>Thống kê Bot Đang Triển Khai</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Tên Chiến Thuật</th>
                      <th>Vị Thế</th>
                      <th>Mã</th>
                      <th>Tín Hiệu</th>
                      <th>Tổng Lãi & Lỗ</th>
                      <th>% Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bots.map(bot => (
                      <tr key={bot.id}>
                        <td style={{ fontWeight: 500 }}>{bot.strategyName}</td>
                        <td>
                          <span className={`badge ${bot.botType?.toLowerCase()}`}>
                            {bot.botType}
                          </span>
                        </td>
                        <td>{bot.symbol}</td>
                        <td>{bot.results?.numberOfSignals || 0}</td>
                        <td className={bot.results?.profit >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: 600 }}>
                          {formatCurrency(bot.results?.profit || 0)}
                        </td>
                        <td className={bot.results?.return >= 0 ? 'text-green' : 'text-red'}>
                          {((bot.results?.return || 0) * 100).toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="card chart-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 18 }}>Biểu đồ Hiệu Suất (NAV)</h2>
                
                <select 
                  value={selectedStrategy} 
                  onChange={e => setSelectedStrategy(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'var(--panel-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    outline: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family)'
                  }}
                >
                  {uniqueStrategies.map(name => (
                    <option key={name} value={name}>
                      Chiến lược: {name}
                    </option>
                  ))}
                </select>
              </div>
              
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis 
                    dataKey="timeLabel" 
                    stroke="var(--text-secondary)" 
                    tick={{fontSize: 12}} 
                    minTickGap={40}
                    tickMargin={10}
                  />
                  <YAxis 
                    stroke="var(--text-secondary)" 
                    tick={{fontSize: 12}} 
                    domain={['auto', 'auto']} 
                    tickFormatter={(value) => (value / 1000000).toFixed(1) + 'M'}
                    width={60}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: 8 }}
                    formatter={(value, name) => [formatCurrency(value), `Bot ${name}`]}
                    labelStyle={{ color: 'var(--text-secondary)', marginBottom: 4 }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 20 }} />
                  {availableBotTypes.includes('LONG') && (
                    <Line 
                      isAnimationActive={false}
                      type="monotone" 
                      dataKey="LONG" 
                      stroke="var(--success-color)" 
                      strokeWidth={3} 
                      dot={false} 
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      name="LONG" 
                      connectNulls={true}
                    />
                  )}
                  {availableBotTypes.includes('SHORT') && (
                    <Line 
                      isAnimationActive={false}
                      type="monotone" 
                      dataKey="SHORT" 
                      stroke="var(--danger-color)" 
                      strokeWidth={3} 
                      dot={false} 
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      name="SHORT" 
                      connectNulls={true}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Bảng Xếp Hạng Thực Tế Dành Cho Giao Diện Web */}
          <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Award size={36} color="#f5b71b" />
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Bảng Xếp Hạng Hiệu Suất</h2>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Top các Bot mang lại lợi nhuận cao nhất</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 8, background: 'var(--bg-color)', padding: 4, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                {[
                  { id: 'day', label: 'Hôm Nay' },
                  { id: 'week', label: 'Tuần Này' },
                  { id: 'month', label: 'Tháng Này' },
                  { id: 'year', label: 'Năm Nay' }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setLeaderboardTimeframe(tab.id)}
                    style={{ 
                      padding: '8px 16px', borderRadius: 6, border: 'none', fontWeight: 600,
                      background: leaderboardTimeframe === tab.id ? 'var(--accent-color)' : 'transparent',
                      color: leaderboardTimeframe === tab.id ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button onClick={exportLeaderboard} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent-color)', fontWeight: 'bold', padding: '12px 20px' }}>
                <ImageIcon size={20} /> TẢI ẢNH BXH XỊN XÒ (HD)
              </button>
            </div>
            
            {/* Top 3 Flex Grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', gap: '24px', marginBottom: '32px', minHeight: '320px' }}>
              {leaderboard.slice(0, 3).map((bot, i) => {
                // Sắp xếp lại thứ tự: Hạng 2, Hạng 1, Hạng 3 để tạo bục vinh quang
                const index = i === 0 ? 1 : i === 1 ? 0 : 2; 
                const actualBot = leaderboard[index];
                if (!actualBot) return null;
                
                const isGold = index === 0;
                const isSilver = index === 1;
                const bgGradient = isGold ? 'linear-gradient(180deg, #fffdf7 0%, #fff 58%, #fff9e9 100%)' :
                                   isSilver ? 'linear-gradient(180deg, #f7fbff, #cbd9e8)' :
                                   'linear-gradient(180deg, #fffaf6, #fff 65%, #fff6ee)';
                const borderColor = isGold ? 'rgba(245,183,27,0.82)' : isSilver ? 'rgba(162,191,222,0.72)' : 'rgba(215,154,92,0.62)';

                return (
                  <div key={actualBot.id} style={{ 
                    flex: '1 1 250px',
                    maxWidth: '350px',
                    minHeight: isGold ? '320px' : isSilver ? '280px' : '260px',
                    background: bgGradient, 
                    border: `1.5px solid ${borderColor}`,
                    borderRadius: '28px',
                    padding: isGold ? '40px 24px 24px' : '30px 24px 24px',
                    textAlign: 'center',
                    boxShadow: isGold ? `0 24px 48px rgba(245,183,27,0.23)` : '0 22px 44px rgba(8,33,79,0.1)',
                    position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    order: isGold ? 2 : isSilver ? 1 : 3
                  }}>
                    {isGold && (
                      <div style={{ position: 'absolute', top: -16, background: '#f5b71b', padding: '4px 16px', borderRadius: 20, color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 4px 12px rgba(245,183,27,0.4)' }}>
                        <Crown size={16} /> TOP 1 XUẤT SẮC
                      </div>
                    )}
                    <div style={{ 
                      width: isGold ? '64px' : '48px', height: isGold ? '64px' : '48px', 
                      borderRadius: isGold ? '42px' : '30px', 
                      background: isGold ? 'linear-gradient(145deg, #fff7cf, #f5b71b 58%, #fff0b2)' : isSilver ? 'linear-gradient(145deg, #f7fbff, #cbd9e8)' : 'linear-gradient(145deg, #fff0df, #d79a5c 60%, #ffd8b0)', 
                      color: isGold ? '#9b5c00' : isSilver ? '#536781' : '#7a3f13',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      fontSize: isGold ? '28px' : '20px', fontWeight: 900, marginBottom: '16px',
                      border: isGold ? '3px solid #ffdf7b' : isSilver ? '2px solid #dfe8f3' : '2px solid #f0bd87',
                      boxShadow: '0 12px 24px rgba(8,33,79,0.15)'
                    }}>
                      {index + 1}
                    </div>
                    <div style={{ fontSize: isGold ? '22px' : '18px', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>
                      {actualBot.strategyName}
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <span className={`badge ${actualBot.botType?.toLowerCase()}`} style={{ fontSize: 11, marginRight: 8 }}>{actualBot.botType}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{actualBot.symbol}</span>
                    </div>
                    <div className={actualBot.todayProfit > 0 ? 'text-green' : actualBot.todayProfit < 0 ? 'text-red' : ''} style={{ fontSize: '24px', fontWeight: 800 }}>
                      {actualBot.todayProfit > 0 ? '+' : ''}{formatCurrency(actualBot.todayProfit)}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Danh sách các bot còn lại */}
            {leaderboard.length > 3 && (
              <div style={{ background: 'var(--bg-color)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                {leaderboard.slice(3, 10).map((bot, index) => (
                  <div key={bot.id} style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    padding: '16px 24px', 
                    borderBottom: index < Math.min(leaderboard.length - 4, 6) ? '1px solid var(--border-color)' : 'none',
                    background: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ width: '32px', fontSize: '18px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>
                        #{index + 4}
                      </div>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{bot.strategyName}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span className={`badge ${bot.botType?.toLowerCase()}`} style={{ padding: '2px 4px', fontSize: 10 }}>{bot.botType}</span>
                          <span>•</span>
                          <span>{bot.symbol}</span>
                        </div>
                      </div>
                    </div>
                    <div className={bot.todayProfit > 0 ? 'text-green' : bot.todayProfit < 0 ? 'text-red' : ''} style={{ fontSize: '18px', fontWeight: 700 }}>
                      {bot.todayProfit > 0 ? '+' : ''}{formatCurrency(bot.todayProfit)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Component Bảng Xếp Hạng Siêu To Khổng Lồ ẩn dưới nền để phục vụ việc xuất ảnh */}
          <EpicLeaderboard 
            ref={epicLeaderboardRef} 
            leaderboard={leaderboard} 
            timeframe={leaderboardTimeframe}
            dateStr={new Date().toLocaleDateString('vi-VN')} 
          />
        </>
      )}
    </div>
  );
}

export default App;
