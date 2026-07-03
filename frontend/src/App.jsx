import { useState, useEffect } from "react"
import { Scatter } from "react-chartjs-2"
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
} from "chart.js"
import heroImg from "./assets/IMG_6984.JPG"
import "./App.css"

ChartJS.register(LinearScale, PointElement, Tooltip, Legend)

const API_BASE = "http://localhost:8000"

const CLUBS = [
  "LW_0-40", "LW_40-50", "LW_50-60", "LW_60-70",
  "SW_70-75", "SW_75-85",
  "GW", "PW", "9 IRON", "8 IRON", "7 IRON",
  "5 WOOD", "DRIVER"
]

// ------------------------------------------------
// Navigation
// ------------------------------------------------

function Nav({ activePage, setActivePage }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav className={`nav ${scrolled ? "nav-scrolled" : ""}`}>
      <span className="nav-logo">ShotLab</span>
      <ul className="nav-links">
        {["overview", "metrics", "analysis", "sessions", "upload"].map(page => (
          <li key={page}>
            <button
              className={activePage === page ? "active" : ""}
              onClick={() => setActivePage(page)}
            >
              {page === "metrics" ? "Club Metrics" :
               page === "overview" ? "Overview" :
               page.charAt(0).toUpperCase() + page.slice(1)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ------------------------------------------------
// Landing Page
// ------------------------------------------------

function LandingPage({ sessions, setActivePage }) {
  return (
    <div>
      <section className="hero">
        <img src={heroImg} alt="Golf swing" className="hero-bg" />
        <div className="hero-content">
          <h1 className="hero-title">
            The Numbers<br />Behind the Swing
          </h1>
          <p className="hero-byline">
            Jacqueline Zang · Information Systems &amp; AI · Carnegie Mellon
          </p>
          <p className="hero-description">
            A personal data project exploring what actually predicts a my quality shot across different clubs.
          </p>
          <div className="hero-stats">
            <div>
              <span className="hero-stat-number">1,184</span>
              <span className="hero-stat-label">Total Shots</span>
            </div>
            <div>
              <span className="hero-stat-number">13</span>
              <span className="hero-stat-label">Clubs Tracked</span>
            </div>
            <div>
              <span className="hero-stat-number">{sessions.length || 32}</span>
              <span className="hero-stat-label">Range Sessions</span>
            </div>
          </div>
          <button className="hero-cta" onClick={() => setActivePage("metrics")}>
            Explore the Data →
          </button>
        </div>
      </section>

      <section style={{ background: "#0d0d0d", padding: "96px 48px" }}>
        <div className="about-section">
          <div>
            <p className="about-label">About This Project</p>
            <h2 className="about-heading">
              What variables actually <em>predict</em> a great shot?
            </h2>
            <p className="about-body">
              My dad mentioned to me that he had a theory that a specific club path and face angle
              produces my best shots. This project tests that, as well as other club and ball metrics:
              smash factor, attack angle, and club speed consistency. The data tells the story about 
              what works to produce my best shots. 
            </p>
          </div>
          <div className="about-facts">
            <div>
              <p className="about-fact-label">Trackman Launch Monitor</p>
              <p className="about-fact-text">
                Every shot captured with club speed, ball speed, spin rate, attack angle,
                club path, face angle, carry, and side offline distance data.
              </p>
            </div>
            <div>
              <p className="about-fact-label">My Clubs, Every Session</p>
              <p className="about-fact-text">
                My 9 most used clubs tracked across 32 range sessions, with 
                sub ranges for my wedges to track pitches from August 2025 onward.
              </p>
            </div>
            <div>
              <p className="about-fact-label">Defining Shot Quality</p>
              <p className="about-fact-text">
                A great shot needs to have tight carry dispersion (be near my target carry), 
                as well as minimal side deviation. Two main variables to optimize.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="navigate-section">
        <p className="navigate-label">Navigate</p>
        <div className="navigate-cards">
          {[
            { page: "metrics", title: "Club Metrics", desc: "Avg carry, dispersion, std dev by club" },
            { page: "analysis", title: "Analysis", desc: "Correlations, regression, predictor importance" },
            { page: "sessions", title: "Sessions", desc: `All ${sessions.length || 32} range sessions with shot counts` },
          ].map(card => (
            <div key={card.page} className="navigate-card" onClick={() => setActivePage(card.page)}>
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <span className="footer-left">ShotLab - Personal Golf Swing Analytics Platform</span>
        <span className="footer-right">Powered by Trackman</span>
      </footer>
    </div>
  )
}

// ------------------------------------------------
// The club metrics page
// ------------------------------------------------

function ClubMetricsPage() {
  const [selectedClub, setSelectedClub] = useState("PW")
  const [data, setData] = useState(null)
  const [shots, setShots] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setData(null)
    setShots([])

    fetch(`${API_BASE}/clubs/${encodeURIComponent(selectedClub)}/metrics`)
      .then(res => res.json())
      .then(json => {
        setData(json)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch(`${API_BASE}/clubs/${encodeURIComponent(selectedClub)}/shots`)
      .then(res => res.json())
      .then(json => setShots(json))
      .catch(() => setShots([]))
  }, [selectedClub])

  const classifyShot = (shot, targets) => {
    if (!targets) return "MISS"

    const side = Math.abs(shot.side_ft)
    const carry = shot.carry

    const sideGreat = targets.great_side_ft
    const sideAcceptable = targets.acceptable_side_ft

    // clubs with no carry target — classify by side only
    const noCarryTarget = !targets.target_carry

    if (noCarryTarget) {
      if (side <= sideGreat) return "GREAT"
      if (side <= sideAcceptable) return "ACCEPTABLE"
      return "MISS"
    }

    // clubs with carry target — classify by both side and carry
    const carryGreatLow = targets.great_carry_low
    const carryGreatHigh = targets.great_carry_high
    const carryAccLow = targets.acceptable_carry_low
    const carryAccHigh = targets.acceptable_carry_high

    const sideOkGreat = side <= sideGreat
    const sideOkAcc = side <= sideAcceptable

    const carryOkGreat = carryGreatLow !== null &&
      carry >= carryGreatLow &&
      (carryGreatHigh === null || carry <= carryGreatHigh)

    const carryOkAcc = carryAccLow !== null &&
      carry >= carryAccLow &&
      (carryAccHigh === null || carry <= carryAccHigh)

    if (sideOkGreat && carryOkGreat) return "GREAT"
    if (sideOkAcc && carryOkAcc) return "ACCEPTABLE"
    return "MISS"
  }

  const getScatterData = () => {
    if (!shots.length || !data) return { datasets: [] }

    const great = []
    const acceptable = []
    const miss = []

    shots.forEach(s => {
      const point = { x: parseFloat((s.side_ft).toFixed(2)), y: s.carry }
      const tier = classifyShot(s, data.targets)
      if (tier === "GREAT") great.push(point)
      else if (tier === "ACCEPTABLE") acceptable.push(point)
      else miss.push(point)
    })

    return {
      datasets: [
        {
          label: "Great",
          data: great,
          backgroundColor: "rgba(31, 166, 7, 0.75)",
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: "Acceptable",
          data: acceptable,
          backgroundColor: "rgba(201, 168, 76, 0.75)",
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: "Miss",
          data: miss,
          backgroundColor: "rgba(196, 8, 8, 0.75)",
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ]
    }
  }

  const scatterOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: "#9ca3af",
          font: { size: 11 },
          boxWidth: 10,
        }
      },
      tooltip: {
        callbacks: {
          label: ctx => `Side: ${ctx.parsed.x.toFixed(1)} ft, Carry: ${ctx.parsed.y} yds`
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: "← Left / Right → (ft)", color: "#9ca3af", font: { size: 11 } },
        ticks: { color: "#9ca3af" },
        grid: { color: "#1a1a1a" },
      },
      y: {
        title: { display: true, text: "Carry (yds)", color: "#9ca3af", font: { size: 11 } },
        ticks: { color: "#9ca3af" },
        grid: { color: "#1a1a1a" },
      }
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <p className="page-label">Club Performance</p>
        <h1 className="page-title">Club Metrics</h1>
        <p className="page-subtitle">Select a club to view carry distance, dispersion, and shot distribution.</p>
      </div>
      <div className="page-content">
        <div className="club-selector-row">
          <p className="selector-label">Select Club</p>
          <div className="club-buttons">
            {CLUBS.map(club => (
              <button
                key={club}
                className={`club-btn ${selectedClub === club ? "active" : ""}`}
                onClick={() => setSelectedClub(club)}
              >
                {club}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="loading">Loading {selectedClub} data...</p>}

        {data && (
          <>
            <p className="performance-label">{selectedClub} — Performance Summary</p>
            <div className="stats-row">
              {[
                { label: "Avg Carry", value: data.stats.avg_carry, unit: "yds", sub: data.targets?.target_carry ? `Target: ${data.targets.target_carry} yds` : null },
                { label: "Carry Std Dev", value: data.stats.std_carry, unit: "yds", sub: null },
                { label: "Avg Side", value: data.stats.avg_side_ft, unit: "ft", sub: data.stats.avg_side_ft < 0 ? "Left bias" : "Right bias" },
                { label: "Side Std Dev", value: data.stats.std_side_ft, unit: "ft", sub: data.targets?.acceptable_side_ft ? `Acceptable: ±${data.targets.acceptable_side_ft} ft` : null },
                { label: "Shot Count", value: data.stats.shot_count, unit: "shots", sub: null },
              ].map(stat => (
                <div key={stat.label} className="stat-card">
                  <p className="stat-card-label">{stat.label}</p>
                  <p className="stat-card-value">
                    {stat.value} <span className="stat-card-unit">{stat.unit}</span>
                  </p>
                  {stat.sub && <p className="stat-card-sub">{stat.sub}</p>}
                </div>
              ))}
            </div>

            <div className="charts-row">
              <div className="chart-card">
                <h3 className="chart-card-title">Shot Dispersion</h3>
                <p className="chart-card-subtitle">Carry vs Side — {selectedClub}</p>
                {shots.length > 0
                  ? <Scatter data={getScatterData()} options={scatterOptions} />
                  : <p className="loading">Loading shot data...</p>
                }
              </div>

              <div className="chart-card">
                <h3 className="chart-card-title">Dispersion Thresholds</h3>
                <p className="chart-card-subtitle">Quality Zones for {selectedClub}</p>
                {data.targets ? (
                  <table className="thresholds-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Great</th>
                        <th>Acceptable</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Carry</td>
                        <td className="threshold-great">
                          {data.targets.great_carry_low && data.targets.great_carry_high
                            ? `±${((data.targets.great_carry_high - data.targets.great_carry_low) / 2).toFixed(1)} yds`
                            : data.targets.great_carry_low ? `${data.targets.great_carry_low}+ yds` : "—"}
                        </td>
                        <td className="threshold-acceptable">
                          {data.targets.acceptable_carry_low && data.targets.acceptable_carry_high
                            ? `±${((data.targets.acceptable_carry_high - data.targets.acceptable_carry_low) / 2).toFixed(1)} yds`
                            : data.targets.acceptable_carry_low ? `${data.targets.acceptable_carry_low}+ yds` : "—"}
                        </td>
                      </tr>
                      <tr>
                        <td>Side</td>
                        <td className="threshold-great">±{data.targets.great_side_ft} ft</td>
                        <td className="threshold-acceptable">±{data.targets.acceptable_side_ft} ft</td>
                      </tr>
                      {data.targets.target_carry && (
                        <tr>
                          <td>Target Carry</td>
                          <td className="threshold-great">{data.targets.target_carry} yds</td>
                          <td className="threshold-acceptable">{data.targets.target_carry} yds</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <p className="loading">No targets defined for this club group.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------
// Analysis Page
// ------------------------------------------------

function AnalysisPage() {
  return (
    <div className="page">
      <div className="page-header">
        <p className="page-label">Statistical Analysis</p>
        <h1 className="page-title">Analysis</h1>
        <p className="page-subtitle">Correlation results, regression findings, and which variables actually predict shot quality.</p>
      </div>
      <div className="page-content">
        <div className="analysis-placeholder">
          <h3>Analysis Coming Soon</h3>
          <p>Pearson correlation coefficients and OLS regression results will appear here once the model pipeline is built.</p>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------
// Sessions page
// ------------------------------------------------

function SessionsPage({ sessions }) {
  const totalShots = 1184
  const avgPerSession = sessions.length ? Math.round(totalShots / sessions.length) : 0

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p className="page-label">Training Log</p>
          <h1 className="page-title">Sessions</h1>
          <p className="page-subtitle">All {sessions.length} range sessions from August 2025 through June 2026.</p>
        </div>
        <div className="sessions-header-stats">
          <div className="sessions-stat">
            <span className="sessions-stat-number">{sessions.length}</span>
            <span className="sessions-stat-label">Sessions</span>
          </div>
          <div className="sessions-stat">
            <span className="sessions-stat-number">1,184</span>
            <span className="sessions-stat-label">Total Shots</span>
          </div>
          <div className="sessions-stat">
            <span className="sessions-stat-number">{avgPerSession}</span>
            <span className="sessions-stat-label">Avg / Session</span>
          </div>
        </div>
      </div>
      <div className="page-content">
        <div className="sessions-grid">
          {sessions.map((s, i) => (
            <div key={s.session_id} className="session-card">
              <p className="session-number">#{String(i + 1).padStart(2, "0")}</p>
              <p className="session-date">{formatDate(s.session_date)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------
// Upload page
// ------------------------------------------------

function UploadPage() {
  return (
    <div className="page">
      <div className="page-header">
        <p className="page-label">Data Ingestion</p>
        <h1 className="page-title">Upload Session Data</h1>
        <p className="page-subtitle">Add a new Trackman session CSV to the dataset. Columns are mapped automatically.</p>
      </div>
      <div className="page-content" style={{ display: "flex", justifyContent: "center" }}>
        <div className="upload-card">
          <p className="selector-label">Trackman CSV Export</p>
          <div className="upload-dropzone">
            <div style={{ fontSize: "32px", marginBottom: "16px", color: "#c9a84c" }}>↑</div>
            <p>Drop your Trackman CSV here</p>
            <small>or click to browse · .csv files only</small>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="upload-submit">Upload Session →</button>
          </div>
          <p className="upload-coming-soon">S3 / Lambda pipeline coming soon — upload functionality will be live after cloud deployment.</p>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------
// This is for the root app
// ------------------------------------------------

export default function App() {
  const [activePage, setActivePage] = useState("overview")
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    fetch(`${API_BASE}/sessions`)
      .then(res => res.json())
      .then(data => setSessions(data))
      .catch(err => console.error("Failed to fetch sessions:", err))
  }, [])

  return (
    <div className="app">
      <Nav activePage={activePage} setActivePage={setActivePage} />
      {activePage === "overview" && <LandingPage sessions={sessions} setActivePage={setActivePage} />}
      {activePage === "metrics" && <ClubMetricsPage />}
      {activePage === "analysis" && <AnalysisPage />}
      {activePage === "sessions" && <SessionsPage sessions={sessions} />}
      {activePage === "upload" && <UploadPage />}
    </div>
  )
}