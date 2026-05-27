import React, { forwardRef } from 'react';
import './EpicLeaderboard.css';

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const EpicLeaderboard = forwardRef(({ leaderboard, dateStr, timeframe }, ref) => {
  const timeframeText = timeframe === 'day' ? 'Hôm Nay' : timeframe === 'week' ? 'Tuần Này' : timeframe === 'month' ? 'Tháng Này' : 'Năm Nay';
  
  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];
  const rest = leaderboard.slice(3, 10);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -1000 }}>
      <div ref={ref} className="epic-container" style={{ width: '1200px' }}>
        <main className="epic-poster">
          <div className="epic-bg-line">
            <svg viewBox="0 0 1200 260" fill="none">
              <path d="M0 180 C120 90 210 210 330 122 C480 12 592 188 728 92 C850 6 972 78 1200 24" stroke="#56C6F6" strokeWidth="4"/>
              <path d="M0 212 C190 135 330 238 515 126 C690 22 824 142 1200 66" stroke="#A9E6FF" strokeWidth="2" opacity=".8"/>
            </svg>
          </div>
          <section className="epic-header">
            <div className="epic-eyeblock">
              <h1 className="epic-h1">BẢNG XẾP HẠNG <span>HIỆU SUẤT</span></h1>
              <div className="epic-subtitle">Top Giao Dịch Đỉnh Cao {timeframeText}</div>
              <div className="epic-date">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2"/>
                  <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                {dateStr}
              </div>
            </div>
            <img className="epic-logo" src="data:image/png;base64,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" alt="pháisinh.online" />
          </section>
          
          <section className="epic-podium">
            {/* Rank 2 */}
            {top2 && (
              <article className="epic-card epic-rank2">
                <div className="epic-medal epic-silver">2</div>
                <div className="epic-name">{top2.strategyName}</div>
                <div className="epic-tag">
                  <span className={`epic-${top2.botType?.toLowerCase()}`}>{top2.botType}</span>
                  <span>|</span>
                  <span>{top2.symbol}</span>
                </div>
                <div className="epic-label">LỢI NHUẬN</div>
                <div className={`epic-value ${top2.todayProfit < 0 ? 'negative' : ''}`}>
                  {top2.todayProfit > 0 ? '+' : ''}{formatCurrency(top2.todayProfit)}
                </div>
              </article>
            )}

            {/* Rank 1 */}
            {top1 && (
              <article className="epic-card epic-rank1">
                <div className="epic-crown">♛</div><div className="epic-laurel"></div>
                <div className="epic-medal epic-gold">1</div>
                <div className="epic-name">{top1.strategyName}</div>
                <div className="epic-tag">
                  <span className={`epic-${top1.botType?.toLowerCase()}`}>{top1.botType}</span>
                  <span>|</span>
                  <span>{top1.symbol}</span>
                </div>
                <div className="epic-label">LỢI NHUẬN</div>
                <div className={`epic-value ${top1.todayProfit < 0 ? 'negative' : ''}`}>
                  {top1.todayProfit > 0 ? '+' : ''}{formatCurrency(top1.todayProfit)}
                </div>
              </article>
            )}

            {/* Rank 3 */}
            {top3 && (
              <article className="epic-card epic-rank3">
                <div className="epic-medal epic-bronze">3</div>
                <div className="epic-name">{top3.strategyName}</div>
                <div className="epic-tag">
                  <span className={`epic-${top3.botType?.toLowerCase()}`}>{top3.botType}</span>
                  <span>|</span>
                  <span>{top3.symbol}</span>
                </div>
                <div className="epic-label">LỢI NHUẬN</div>
                <div className={`epic-value ${top3.todayProfit < 0 ? 'negative' : ''}`}>
                  {top3.todayProfit > 0 ? '+' : ''}{formatCurrency(top3.todayProfit)}
                </div>
              </article>
            )}
          </section>
          
          {rest.length > 0 && (
            <section className="epic-table">
              {rest.map((bot, idx) => (
                <div className="epic-row" key={bot.id || idx}>
                  <div className="epic-badge">#{idx + 4}</div>
                  <div className="epic-strategy">{bot.strategyName}</div>
                  <div className={`epic-side epic-${bot.botType?.toLowerCase()}`}>{bot.botType}</div>
                  <div className="epic-dot"></div>
                  <div className="epic-instrument">{bot.symbol}</div>
                  <div className={`epic-profit ${bot.todayProfit < 0 ? 'negative' : ''}`}>
                    {bot.todayProfit > 0 ? '+' : ''}{formatCurrency(bot.todayProfit)}
                  </div>
                </div>
              ))}
            </section>
          )}
        </main>
      </div>
    </div>
  );
});

export default EpicLeaderboard;
