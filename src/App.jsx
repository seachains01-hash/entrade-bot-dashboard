import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, TrendingUp, TrendingDown, Settings, LogOut, Award, Clock, Download, Image as ImageIcon, Crown, Radio, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import EpicLeaderboard from './EpicLeaderboard';
import { generateMockBots } from './mockDataGenerator';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', textAlign: 'center' }}>
          <h2>Đã xảy ra lỗi hệ thống</h2>
          <pre>{this.state.error?.toString()}</pre>
          <button onClick={() => window.location.reload()}>Tải lại trang</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Hàm format tiền tệ
const formatCurrency = (value) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(value);
};

// Map Alias cho Tên Chiến thuật
const getAliasName = (name) => {
  if (!name) return 'Unknown';
  if (name.includes('CNPS4')) return 'CNPS4 - BB/SMA HTF';
  if (name.includes('CNPS5')) return 'CNPS5 - SMA/ADX';
  if (name.includes('CNPS6')) return 'CNPS6 - BB/ADX';
  if (name.includes('CNPS7')) return 'CNPS7 - 3SMA Cross';
  return name;
};

const getValidTime = (deal) => {
  const isInvalidDateString = (t) => {
    if (!t) return true;
    if (t === 0 || t === "0") return true;
    if (typeof t === 'string') {
      if (t.includes('0001-01-01') || t.includes('0000-11-30') || t.startsWith('0001-') || t.startsWith('0000-')) return true;
    }
    return false;
  };

  if (!isInvalidDateString(deal.closeTime)) return deal.closeTime;
  if (!isInvalidDateString(deal.openTime)) return deal.openTime;
  if (!isInvalidDateString(deal.dealTime)) return deal.dealTime;
  return null;
};

// Filter deals by timeframe
const filterDealsByTimeframe = (deals, tf) => {
  if (!deals) return [];
  const validDeals = deals.filter(d => getValidTime(d) !== null);
  
  if (tf === 'ALL') return validDeals;
  const now = new Date();
  let startTime = 0;
  
  if (tf === 'DAY') {
    startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  } else if (tf === 'WEEK') {
    const day = now.getDay() || 7; 
    startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1).getTime();
  } else if (tf === 'MONTH') {
    startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  } else if (tf === 'QUARTER') {
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    startTime = new Date(now.getFullYear(), qMonth, 1).getTime();
  } else if (tf === 'YEAR') {
    startTime = new Date(now.getFullYear(), 0, 1).getTime();
  }
  
  return validDeals.filter(d => new Date(getValidTime(d)).getTime() >= startTime);
};

// Hàm xử lý dữ liệu bot chi tiết
const processBotData = (bot, tf) => {
  const allDeals = bot.results?.deals || [];
  const deals = filterDealsByTimeframe(allDeals, tf);
  
  // Tính Winrate
  const winDeals = deals.filter(d => d.netProfit > 0).length;
  const winrate = deals.length > 0 ? ((winDeals / deals.length) * 100).toFixed(1) : 0;
  
  // Tìm lệnh gần nhất trên toàn bộ lịch sử (ưu tiên lệnh mới nhất dựa vào openTime hoặc closeTime)
  const allSortedDealsDesc = [...allDeals].sort((a,b) => {
    const timeA = new Date(getValidTime(a) || 0).getTime();
    const timeB = new Date(getValidTime(b) || 0).getTime();
    return timeB - timeA;
  });
  const absoluteLastDeal = allSortedDealsDesc[0];
  let lastSignalTime = absoluteLastDeal ? getValidTime(absoluteLastDeal) : null;
  
  let formattedLastTime = '-';
  if (lastSignalTime) {
    try {
      const d = new Date(lastSignalTime);
      formattedLastTime = d.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
    } catch(e) {}
  }

  // Calculate timeframe-specific profit & return
  let profit = 0;
  let returnPct = 0;
  if (tf === 'ALL') {
    profit = bot.results?.profit || 0;
    returnPct = bot.results?.return || 0;
  } else {
    profit = deals.reduce((sum, d) => sum + (d.netProfit || 0), 0);
    returnPct = (profit / 30000000) * 100;
  }

  // Drawdown in timeframe
  let maxDrawdown = 0;
  if (deals.length > 0) {
     let peak = 30000000;
     let current = 30000000;
     const sortedDealsAsc = [...deals].sort((a,b) => new Date(a.closeTime) - new Date(b.closeTime));
     sortedDealsAsc.forEach(d => {
       current += d.netProfit || 0;
       if (current > peak) peak = current;
       const dd = ((peak - current) / peak) * 100;
       if (dd > maxDrawdown) maxDrawdown = dd;
     });
  } else {
    maxDrawdown = bot.results?.drawdown || (profit < 0 ? Math.abs(returnPct) : 0);
  }

  return {
    ...bot,
    alias: getAliasName(bot.strategyName),
    uniqueAlias: `${getAliasName(bot.strategyName)} (${bot.botType || 'NEUTRAL'})`,
    winrate,
    tradesCount: deals.length,
    lastSignalTime: formattedLastTime,
    rawLastTime: lastSignalTime,
    drawdown: maxDrawdown ? maxDrawdown.toFixed(2) + '%' : '0%',
    entryPrice: bot.entryPrice || '-',
    displayStatus: bot.status === 'RUNNING' ? 'Running' : (bot.status || 'Paused'),
    timeframeProfit: profit,
    timeframeReturn: returnPct
  };
};

const AppContent = () => {
  const [token, setToken] = useState(localStorage.getItem('entrade_token') || '');
  const [isSetup, setIsSetup] = useState(!!localStorage.getItem('entrade_token'));
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginMethod, setLoginMethod] = useState('token'); // 'token' or 'account'
  const [inputToken, setInputToken] = useState('');
  
  const [chartMode, setChartMode] = useState('total'); // 'total' or 'compare'
  const [hiddenBots, setHiddenBots] = useState([]);
  
  const [timeframe, setTimeframe] = useState('ALL'); // 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR', 'ALL'
  const [isMockMode, setIsMockMode] = useState(false);
  
  const epicLeaderboardRef = useRef(null);
  const previewWrapperRef = useRef(null);
  const previewContentRef = useRef(null);
  const [previewStyle, setPreviewStyle] = useState({ scale: 1, height: 'auto' });
  
  const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  // --- HOOKS ---
  
  // Xử lý dữ liệu Bots
  const processedBots = useMemo(() => bots.map(b => processBotData(b, timeframe)), [bots, timeframe]);

  // Tính toán KPIs
  const kpis = useMemo(() => {
    let totalNav = 0;
    let totalProfit = 0;
    let longCount = 0;
    let shortCount = 0;
    let runningCount = 0;

    processedBots.forEach(bot => {
      totalProfit += bot.timeframeProfit || 0;
      if (bot.botType === 'LONG') longCount++;
      if (bot.botType === 'SHORT') shortCount++;
      if (bot.displayStatus === 'Running') runningCount++;
      
      totalNav += 30000000 + (bot.timeframeProfit || 0); 
    });

    const returnPct = (totalProfit / (processedBots.length * 30000000 || 1)) * 100;

    return {
      totalNav,
      totalProfit,
      returnPct: returnPct.toFixed(2),
      longCount,
      shortCount,
      neutralCount: processedBots.length - longCount - shortCount,
      runningCount,
      totalCount: processedBots.length
    };
  }, [processedBots]);

  // Xử lý Chart Data (Tổng hợp NAV & Từng Bot)
  const chartData = useMemo(() => {
    if (processedBots.length === 0) return [];
    
    // Thu thập tất cả các deals và sắp xếp theo thời gian
    const allDeals = [];
    processedBots.forEach(bot => {
      const history = bot.results?.deals || [];
      const filteredHistory = filterDealsByTimeframe(history, timeframe);
      
      filteredHistory.forEach(deal => {
        const validT = getValidTime(deal);
        if (validT) {
          try {
            allDeals.push({
              ...deal,
              uniqueAlias: bot.uniqueAlias,
              closeTimeRaw: new Date(validT)
            });
          } catch(e) {}
        }
      });
    });
    
    allDeals.sort((a, b) => a.closeTimeRaw - b.closeTimeRaw);

    let currentTotalNav = 30000000 * processedBots.length;
    const currentPnL = {};
    processedBots.forEach(bot => currentPnL[bot.uniqueAlias] = 30000000); // Khởi tạo mức đầu tư ban đầu là 30M

    const chartPoints = [];
    
    // Khởi tạo điểm đầu tiên
    chartPoints.push({
      time: 'Start',
      totalNav: currentTotalNav,
      ...currentPnL
    });

    allDeals.forEach(deal => {
      let timeStr = deal.closeTimeRaw.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
      if (timeframe !== 'DAY') {
        timeStr = deal.closeTimeRaw.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' }) + ' ' + timeStr;
      }
      
      currentPnL[deal.uniqueAlias] += (deal.netProfit || 0);
      currentTotalNav += (deal.netProfit || 0);
      
      chartPoints.push({
        time: timeStr,
        totalNav: currentTotalNav,
        ...currentPnL
      });
    });

    return chartPoints;
  }, [processedBots, timeframe]);

  // Xử lý Live Signals
  const liveSignals = useMemo(() => {
    const signals = [];
    processedBots.forEach(bot => {
      if (bot.botType === 'LONG' || bot.botType === 'SHORT') {
        signals.push({
          botId: bot.id,
          strategy: bot.alias,
          type: bot.botType,
          time: bot.rawLastTime || new Date().toISOString(),
          displayTime: bot.lastSignalTime
        });
      }
    });
    // Sắp xếp mới nhất lên đầu
    return signals.sort((a, b) => new Date(b.time) - new Date(a.time));
  }, [processedBots]);

  // Xử lý Leaderboard
  const leaderboard = useMemo(() => {
    return [...processedBots].sort((a, b) => {
      const profitA = a.timeframeProfit || 0;
      const profitB = b.timeframeProfit || 0;
      if (profitB !== profitA) return profitB - profitA; // Sort by Profit
      
      // Tie-breaker 1: Return
      const retA = a.timeframeReturn || 0;
      const retB = b.timeframeReturn || 0;
      if (retB !== retA) return retB - retA;

      // Tie-breaker 2: Trades Count
      return b.tradesCount - a.tradesCount;
    });
  }, [processedBots]);

  // Kểm tra xem tất cả bot có bằng 0 hết không
  const isLeaderboardEmpty = useMemo(() => {
    return leaderboard.length === 0 || leaderboard.every(b => (b.timeframeProfit || 0) === 0);
  }, [leaderboard]);

  const dateStr = useMemo(() => {
    return new Date().toLocaleDateString('vi-VN');
  }, []);

  // Responsive logic for Leaderboard Preview
  useEffect(() => {
    if (!previewWrapperRef.current || !previewContentRef.current) return;
    
    const observer = new ResizeObserver(() => {
      if (!previewWrapperRef.current || !previewContentRef.current) return;
      const wrapperWidth = previewWrapperRef.current.clientWidth;
      const contentHeight = previewContentRef.current.offsetHeight;
      
      if (wrapperWidth < 1200 && wrapperWidth > 0) {
        const scale = wrapperWidth / 1200;
        setPreviewStyle({
          scale: scale,
          height: `${contentHeight * scale}px`
        });
      } else {
        setPreviewStyle({
          scale: 1,
          height: 'auto'
        });
      }
    });
    
    observer.observe(previewWrapperRef.current);
    observer.observe(previewContentRef.current);
    
    return () => observer.disconnect();
  }, [leaderboard, timeframe]);

  // Decode JWT safely
  const getInvestorIdFromToken = (t) => {
    try {
      const payload = t.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded.investorId;
    } catch(e) {
      return null;
    }
  };

  // --- API CALLS ---
  const fetchData = async () => {
    if (!token) return;
    if (isMockMode) return; // Không gọi API hay tạo lại data nếu đang ở chế độ Mock
    
    setLoading(true);
    
    try {
      const investorId = getInvestorIdFromToken(token);
      let url = '/api/bot-api/bots?_end=1000&_start=0&status=RUNNING,PENDING_STOP';
      if (investorId) {
        url += `&investorId=${investorId}`;
      }

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API Lỗi ${res.status}: ${text.substring(0, 50)}`);
      }
      
      const resData = await res.json();
      const botsData = Array.isArray(resData) ? resData : (resData.data || []);
      
      if (botsData) {
        setBots(botsData);
        setError('');
      } else {
        throw new Error('Dữ liệu API không đúng định dạng');
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
      if (err.message.includes('Lỗi 401')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSetup || isMockMode) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [isSetup, token, isMockMode]);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (loginMethod === 'token') {
      if (!inputToken.trim()) {
        setError('Vui lòng nhập Token');
        return;
      }
      
      // Tự động xóa chữ "Bearer " nếu user copy dính vào
      let finalToken = inputToken.trim();
      if (finalToken.startsWith('Bearer ')) {
        finalToken = finalToken.replace('Bearer ', '');
      }
      
      localStorage.setItem('entrade_token', finalToken);
      setToken(finalToken);
      setIsSetup(true);
      return;
    }

    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập tài khoản và mật khẩu');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/entrade-api/v2/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      const authToken = data.token || data.accessToken || data.data?.token || data.entrade_token;
      
      // Nếu API trả về yêu cầu OTP, cảnh báo luôn
      if (res.ok && data.requireOtp) {
         throw new Error('Hệ thống yêu cầu nhập mã OTP. Vui lòng sử dụng tính năng Đăng nhập bằng Token!');
      }

      if (res.ok && authToken) {
        localStorage.setItem('entrade_token', authToken);
        setToken(authToken);
        setIsSetup(true);
      } else {
        throw new Error(data.message || data.error || 'Sai tên đăng nhập hoặc mật khẩu');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  const toggleBotVisibility = (alias) => {
    setHiddenBots(prev => 
      prev.includes(alias) ? prev.filter(a => a !== alias) : [...prev, alias]
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('entrade_token');
    setToken('');
    setIsSetup(false);
    setBots([]);
  };

  const exportLeaderboard = async () => {
    if (!previewContentRef.current) return;
    
    const prevMinWidth = document.body.style.minWidth;
    const prevOverflow = document.body.style.overflowX;

    try {
      const target = previewContentRef.current;

      document.body.style.minWidth = '1300px';
      document.body.style.overflowX = 'visible';

      const canvas = await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: 2,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        logging: false
      });
      
      const link = document.createElement('a');
      link.download = `BXH_Bot_Entrade_${dateStr.replace(/\//g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Lỗi khi xuất ảnh:', err);
      alert('Có lỗi khi xuất ảnh, vui lòng thử lại.');
    } finally {
      document.body.style.minWidth = prevMinWidth;
      document.body.style.overflowX = prevOverflow;
    }
  };


  // --- RENDER ---
  if (!isSetup) {
    return (
      <div className="setup-container">
        <div className="card setup-card">
          <Settings size={48} color="var(--accent-color)" style={{ margin: '0 auto 16px' }}/>
          <h2 style={{ marginBottom: '8px' }}>Đăng Nhập Hệ Thống</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Nhập tài khoản Entrade để truy cập Dashboard</p>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', marginTop: '16px' }}>
            <button 
              type="button"
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: loginMethod === 'token' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)', background: loginMethod === 'token' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: loginMethod === 'token' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: 600 }}
              onClick={() => { setLoginMethod('token'); setError(''); }}
            >
              Dùng Token
            </button>
            <button 
              type="button"
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: loginMethod === 'account' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)', background: loginMethod === 'account' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: loginMethod === 'account' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: 600 }}
              onClick={() => { setLoginMethod('account'); setError(''); }}
            >
              User / Pass
            </button>
          </div>

          <form onSubmit={handleLogin}>
            {loginMethod === 'account' ? (
              <>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Tên đăng nhập" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)}
                  style={{ marginBottom: '12px', marginTop: 0 }}
                />
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="Mật khẩu" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  style={{ marginTop: '0', marginBottom: '16px' }}
                />
              </>
            ) : (
              <input 
                type="text" 
                className="input-field" 
                placeholder="Nhập Entrade Token (Bearer...)" 
                value={inputToken} 
                onChange={e => setInputToken(e.target.value)}
                style={{ marginTop: '0', marginBottom: '16px' }}
              />
            )}
            
            {error && <div style={{ color: 'var(--danger-color)', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>{error}</div>}
            
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Đang xác thực...' : 'Đăng Nhập'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div>
          <h1 className="title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity color="var(--accent-color)" size={28}/> 
            Trading Dashboard V2
          </h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={14} /> Dữ liệu trực tiếp ngày {dateStr}
            </span>
            <div style={{ width: '1px', height: '14px', background: 'var(--border-color)' }}></div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['ALL', 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'].map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: 'none',
                    background: timeframe === tf ? 'var(--accent-color)' : 'var(--bg-color)',
                    color: timeframe === tf ? '#fff' : 'var(--text-secondary)',
                    fontWeight: timeframe === tf ? 600 : 400,
                    cursor: 'pointer'
                  }}
                >
                  {tf === 'ALL' ? 'Tất cả' : tf === 'DAY' ? 'Hôm nay' : tf === 'WEEK' ? 'Tuần' : tf === 'MONTH' ? 'Tháng' : tf === 'QUARTER' ? 'Quý' : 'Năm'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => {
            if (!isMockMode) {
              setBots(generateMockBots());
              setIsMockMode(true);
            } else {
              setBots([]); // Xóa data giả, useEffect sẽ tự gọi API lại
              setIsMockMode(false);
            }
          }} className="btn-primary" style={{ background: isMockMode ? 'var(--warning-color)' : 'transparent', color: isMockMode ? '#fff' : 'var(--warning-color)', border: `1px solid var(--warning-color)` }}>
            {isMockMode ? 'Tắt Mock Data' : 'Tạo Dữ Liệu Test'}
          </button>
          <button onClick={handleLogout} className="btn-primary" style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
            <LogOut size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }}/> Đăng xuất
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="card">
          <div className="metric-title">Tổng NAV Hệ Thống</div>
          <div className="metric-value">
            {formatCurrency(kpis.totalNav)}
          </div>
        </div>
        <div className="card">
          <div className="metric-title">Tổng PnL Hôm Nay</div>
          <div className={`metric-value ${kpis.totalProfit >= 0 ? 'text-green' : 'text-red'}`}>
            {kpis.totalProfit >= 0 ? <TrendingUp size={24}/> : <TrendingDown size={24}/>}
            {kpis.totalProfit >= 0 ? '+' : ''}{formatCurrency(kpis.totalProfit)}
          </div>
          <div className={`metric-sub ${kpis.returnPct >= 0 ? 'text-green' : 'text-red'}`} style={{ marginTop: '4px' }}>
            {kpis.returnPct >= 0 ? '+' : ''}{kpis.returnPct}% Return
          </div>
        </div>
        <div className="card">
          <div className="metric-title">Trạng Thái Vận Hành</div>
          <div className="metric-value text-green">
            <CheckCircle size={24}/> {kpis.runningCount} / {kpis.totalCount} Bot
          </div>
          <div className="metric-sub text-green" style={{ marginTop: '4px' }}>Đang chạy (Running)</div>
        </div>
        <div className="card">
          <div className="metric-title">Tín Hiệu Hiện Tại</div>
          <div className="metric-value">
            <Radio size={24} color="var(--accent-color)"/> {kpis.longCount + kpis.shortCount} Active
          </div>
          <div className="metric-sub" style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--success-color)' }}>LONG: {kpis.longCount}</span> | <span style={{ color: 'var(--danger-color)' }}>SHORT: {kpis.shortCount}</span> | Neutral: {kpis.neutralCount}
          </div>
        </div>
      </div>

      {/* Main Area: Chart & Live Signals */}
      <div className="main-area">
        {/* Lệnh trái: Chart */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Biểu Đồ Hiệu Suất</h2>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-color)', padding: '4px', borderRadius: '8px' }}>
              <button 
                onClick={() => setChartMode('total')}
                style={{ fontSize: '13px', padding: '6px 12px', background: chartMode === 'total' ? '#fff' : 'transparent', border: 'none', borderRadius: '4px', fontWeight: chartMode === 'total' ? 600 : 400, boxShadow: chartMode === 'total' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: chartMode === 'total' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              >
                Tổng NAV
              </button>
              <button 
                onClick={() => setChartMode('compare')}
                style={{ fontSize: '13px', padding: '6px 12px', background: chartMode === 'compare' ? '#fff' : 'transparent', border: 'none', borderRadius: '4px', fontWeight: chartMode === 'compare' ? 600 : 400, boxShadow: chartMode === 'compare' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: chartMode === 'compare' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              >
                So sánh Bot (PnL)
              </button>
            </div>
          </div>
          
          {chartMode === 'compare' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {processedBots.map((bot, idx) => {
                const isHidden = hiddenBots.includes(bot.uniqueAlias);
                return (
                  <button
                    key={bot.id}
                    onClick={() => toggleBotVisibility(bot.uniqueAlias)}
                    style={{
                      fontSize: '12px',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      border: `1px solid ${isHidden ? 'var(--border-color)' : COLORS[idx % COLORS.length]}`,
                      background: isHidden ? 'transparent' : `${COLORS[idx % COLORS.length]}15`,
                      color: isHidden ? 'var(--text-secondary)' : COLORS[idx % COLORS.length],
                      fontWeight: isHidden ? 400 : 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isHidden ? 'transparent' : COLORS[idx % COLORS.length], border: `1px solid ${COLORS[idx % COLORS.length]}` }}></div>
                    {bot.uniqueAlias}
                  </button>
                );
              })}
            </div>
          )}

          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.5} vertical={false}/>
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickMargin={10}/>
                
                {chartMode === 'total' ? (
                  <>
                    <YAxis domain={['auto', 'auto']} tickFormatter={(v) => (v/1000000).toFixed(1) + 'M'} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} width={60}/>
                    <Tooltip formatter={(value) => formatCurrency(value)} labelStyle={{ color: '#000', fontWeight: 'bold' }}/>
                    <Line type="monotone" dataKey="totalNav" stroke="var(--accent-color)" strokeWidth={3} dot={false} name="Tổng NAV"/>
                  </>
                ) : (
                  <>
                    <YAxis domain={['auto', 'auto']} tickFormatter={(v) => (v/1000000).toFixed(1) + 'M'} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} width={60}/>
                    <Tooltip formatter={(value) => formatCurrency(value)} labelStyle={{ color: '#000', fontWeight: 'bold' }}/>
                    {processedBots.map((bot, idx) => (
                      !hiddenBots.includes(bot.uniqueAlias) && (
                        <Line key={bot.id} type="monotone" dataKey={bot.uniqueAlias} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={false} name={bot.uniqueAlias}/>
                      )
                    ))}
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lệnh phải: Live Signals */}
        <div className="card signals-container">
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={20} color="var(--danger-color)"/> Live Signals
          </h2>
          <div className="signals-list">
            {liveSignals.length > 0 ? liveSignals.map((sig, idx) => (
              <div key={idx} className="signal-item">
                <div>
                  <div className="signal-time">{sig.displayTime}</div>
                  <div className="signal-content">{sig.strategy}</div>
                </div>
                <div className={`badge ${sig.type?.toLowerCase()}`}>
                  {sig.type}
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>
                <AlertCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }}/>
                Chưa có tín hiệu nào
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bot Table */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Thống Kê Bot Chi Tiết</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Chiến Thuật</th>
                <th>Trạng Thái</th>
                <th>Mã Hợp Đồng</th>
                <th>Vị Thế</th>
                <th>Giá Vào Lệnh</th>
                <th>Tín Hiệu Cuối</th>
                <th>Winrate / Lệnh</th>
                <th>Drawdown</th>
                <th>PnL Hôm Nay</th>
                <th>Return</th>
              </tr>
            </thead>
            <tbody>
              {processedBots.map((bot) => (
                <tr key={bot.id}>
                  <td style={{ fontWeight: 600 }}>{bot.alias}</td>
                  <td>
                    <span className={`badge ${bot.displayStatus === 'Running' ? 'running' : 'paused'}`}>
                      {bot.displayStatus}
                    </span>
                  </td>
                  <td>{bot.symbol}</td>
                  <td>
                    <span className={`badge ${bot.botType ? bot.botType.toLowerCase() : 'none'}`}>
                      {bot.botType || 'NEUTRAL'}
                    </span>
                  </td>
                  <td>{bot.entryPrice}</td>
                  <td>{bot.lastSignalTime}</td>
                  <td>{bot.winrate}% ({bot.tradesCount})</td>
                  <td className="text-red">{bot.drawdown}</td>
                  <td className={`font-medium ${(bot.timeframeProfit || 0) >= 0 ? 'text-green' : 'text-red'}`}>
                    {(bot.timeframeProfit || 0) >= 0 ? '+' : ''}{formatCurrency(bot.timeframeProfit || 0)}
                  </td>
                  <td className={(bot.timeframeReturn || 0) >= 0 ? 'text-green' : 'text-red'}>
                    {(bot.timeframeReturn || 0) >= 0 ? '+' : ''}{(bot.timeframeReturn || 0).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leaderboard Export Section */}
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '16px' }}>
           <Crown size={48} color="var(--warning-color)" />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Bảng Xếp Hạng Truyền Thông</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Dữ liệu xếp hạng dựa trên PnL, Return, và số lệnh giao dịch.</p>

        <button onClick={exportLeaderboard} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <ImageIcon size={20} />
          Tải Ảnh Bảng Xếp Hạng (HD)
        </button>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', marginRight: '8px', display: 'flex', alignItems: 'center' }}>Lọc Khung Thời Gian:</div>
          {['ALL', 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'].map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                fontSize: '13px',
                padding: '6px 16px',
                borderRadius: '20px',
                border: 'none',
                background: timeframe === tf ? 'var(--accent-color)' : 'var(--bg-color)',
                color: timeframe === tf ? '#fff' : 'var(--text-secondary)',
                fontWeight: timeframe === tf ? 600 : 400,
                cursor: 'pointer'
              }}
            >
              {tf === 'ALL' ? 'Tất cả' : tf === 'DAY' ? 'Hôm nay' : tf === 'WEEK' ? 'Tuần' : tf === 'MONTH' ? 'Tháng' : tf === 'QUARTER' ? 'Quý' : 'Năm'}
            </button>
          ))}
        </div>

        <div 
          ref={previewWrapperRef} 
          style={{ width: '100%', overflow: 'hidden', padding: '16px 0', height: previewStyle.height, transition: 'height 0.2s ease' }}
        >
          <div style={{
            transform: `scale(${previewStyle.scale})`,
            transformOrigin: 'top left',
            width: '1200px',
            margin: previewStyle.scale === 1 ? '0 auto' : '0'
          }}>
            <div 
              ref={previewContentRef}
              style={{ minWidth: '1200px', width: '1200px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', borderRadius: '24px', overflow: 'hidden' }}
            >
              <EpicLeaderboard 
                leaderboard={leaderboard} 
                dateStr={dateStr}
                timeframe={timeframe}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;
