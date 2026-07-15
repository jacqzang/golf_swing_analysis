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

function LandingPage({ sessions, totalShots, setActivePage }) {
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
              <span className="hero-stat-number">{totalShots.toLocaleString()}</span>
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
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState("irons")
  const [expandedFinding, setExpandedFinding] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/analysis/latest`)
      .then(res => res.json())
      .then(json => {
        setData(json)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const groupOrder = ["pitches", "wedges", "irons", "driving"]
  const groupLabels = {
    pitches: "Pitches",
    wedges: "Wedges",
    irons: "Irons",
    driving: "Woods & Driver"
  }

  const activeGroup = data?.find(g => g.group === selectedGroup)

  const predictorLabels = {
    club_path: "Club Path",
    face_angle: "Face Angle",
    club_speed: "Club Speed",
    attack_angle: "Attack Angle",
    smash_factor: "Smash Factor"
  }

  const findings = [
    {
      number: "01",
      title: "Face angle consistently affects shot quality",
      bullets: [
        "Face angle was statistically significant in 9 of 13 club groups, more than any other variable.",
        "The strongest relationships were with 8 iron (r = +0.54) and LW 60–70 yards (r = +0.68).",
        "This is important because face angle largely determines the ball's initial launch direction, especially for irons and wedges. Since those are the approach clubs, direction is more important for them.",
        "Small face angle errors increase lateral dispersion, making it harder to finish near the target, so the quality of the shot decreases.",
      ],
      conclusion: "Thus, delivering a square, consistent club face at impact is likely more important than changing swing path for improving shot quality."
    },
    {
      number: "02",
      title: "Club path matters, but under specific conditions",
      bullets: [
        "Club path was significant for the 5 wood, 8 iron, 9 iron, and LW 60–70, but not for most other clubs.",
        "Club path still matters because it influences ball curvature through the face-to-path relationship rather than the ball's initial launch direction.",
        "When face angle is controlled, moderate path changes often have only a small effect on where the shot finishes. However, when the face angle is not controlled, the club path has a larger effect on how the ball curves.",
      ],
      conclusion: "Thus, to produce the highest quality shots, establish consistent face control first, then refine club path to further reduce shot dispersion."
    },
    {
      number: "03",
      title: "Club speed predicts consistency for full irons",
      bullets: [
        "Club speed was statistically significant for 7 iron (r = +0.23), 8 iron (r = +0.45), and 9 iron (r = +0.30), but not for wedges or the driver.",
        "Consistent club speed reflects a consistent swing, leading to more consistent carry distances which are important for approach shots with irons.",
        "Reduced carry variation improves the quality score by keeping shots closer to the intended target distance.",
        "Wedge shots intentionally vary swing length and speed for distance control which makes club speed a less meaningful predictor.",
      ],
      conclusion: "Thus, developing a repeatable swing that produces consistent club speed is an important component of improving iron play. This is something that was not considered before."
    },
    {
      number: "04",
      title: "Pitch shots appear to depend more on feel rather than mechanics",
      bullets: [
        "Pitch shots (0–85 yards) produced almost no meaningful relationships with the measured TrackMan variables (test R² = 0.04).",
        "The shortest lob wedge distances showed no statistically significant correlations with any measured swing variable.",
        "Unlike full swings, pitch shots rely heavily on distance control, trajectory, spin, landing angle, and feel — many of which are not directly captured by the variables in this analysis.",
      ],
      conclusion: "Thus, improving pitch performance likely depends more on touch, practice, and shot selection than on optimizing mechanics alone. They are very different swings, full swings and pitch shots, so this makes sense."
    },
    {
      number: "05",
      title: "Full iron swings are the most predictable part of the game",
      bullets: [
        "The iron regression achieved the highest predictive performance of any club group (test R² = 0.20).",
        "Full iron swings are generally more repeatable than drivers or partial wedges, leading to stronger relationships between swing mechanics and shot quality.",
        "Face angle, club speed, attack angle, and club path together explained more variation in iron shot quality than in any other club category.",
      ],
      conclusion: null
    },
    {
      number: "06",
      title: "Weak regression performance shows the limitations of the measured variables",
      bullets: [
        "The wedge and driving models produced negative test R² values, so the linear models did not reliably predict shot quality.",
        "For wedges, face angle was often the only significant predictor, leaving little additional information for a multi-variable model to learn from.",
        "Driver performance is influenced by many unmeasured factors, including impact location, spin axis, dynamic loft, launch conditions, and tee height.",
      ],
      conclusion: "For the future, more comprehensive measurements or nonlinear machine learning models may better capture the complex relationships that determine wedge and driver performance."
    },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <p className="page-label">Statistical Analysis</p>
        <h1 className="page-title">Analysis</h1>
        <p className="page-subtitle">
          Pearson correlation coefficients and OLS regression results by club group.
          <b> Face angle</b> is the most consistent predictor of shot quality across the bag.
        </p>
      </div>

      <div className="page-content">
        {loading && <p className="loading">Loading analysis results...</p>}

        {data && (
          <>
            {/* Verdict Banner */}
            <div style={{
              background: "#111111",
              border: "1px solid #1e1e1e",
              borderLeft: "3px solid #c9a84c",
              padding: "24px 32px",
              marginBottom: "40px"
            }}>
              <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a84c", marginBottom: "8px" }}>
                Verdict on Theory
              </p>
              <p style={{ fontSize: "18px", color: "#ffffff", fontFamily: "Georgia, serif", lineHeight: "1.6" }}>
                Partially supported because <em>face angle</em> is the primary predictor, rather than both club path and face angle together.
                Face angle is statistically significant in 9 of 13 club groups tested.
                Club path is weaker and inconsistent across the bag.
              </p>
            </div>

            {/* Group Selector */}
            <div className="club-selector-row">
              <p className="selector-label">Select Club Group</p>
              <div className="club-buttons">
                {groupOrder.map(group => (
                  <button
                    key={group}
                    className={`club-btn ${selectedGroup === group ? "active" : ""}`}
                    onClick={() => setSelectedGroup(group)}
                  >
                    {groupLabels[group]}
                  </button>
                ))}
              </div>
            </div>

            {activeGroup && (
              <>
                {/* Regression Summary + Coefficients */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "#1e1e1e", border: "1px solid #1e1e1e", marginBottom: "32px" }}>
                  <div style={{ background: "#111111", padding: "32px" }}>
                    <p className="page-label" style={{ marginBottom: "24px" }}>OLS Regression Model</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      {[
                        { label: "Sample Size", value: `${activeGroup.n} shots` },
                        { label: "R² (train)", value: activeGroup.r2_train },
                        { label: "R² (test)", value: activeGroup.r2_test },
                        { label: "Predictors", value: "Club Path, Face Angle, Club Speed, Attack Angle, Smash Factor" },
                      ].map(item => (
                        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #1a1a1a", paddingBottom: "12px" }}>
                          <span style={{ fontSize: "13px", color: "#9ca3af", letterSpacing: "0.05em" }}>{item.label}</span>
                          <span style={{ fontSize: "13px", color: activeGroup.r2_test < 0 && item.label === "R² (test)" ? "#ef4444" : "#ffffff", fontFamily: "Georgia, serif" }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                    {activeGroup.r2_test < 0.05 && (
                      <p style={{ fontSize: "12px", color: "#9ca3af", fontStyle: "italic", marginTop: "16px" }}>
                        Note: Low R² indicates these swing variables explain limited variance in shot quality for this group.
                      </p>
                    )}
                  </div>

                  <div style={{ background: "#111111", padding: "32px" }}>
                    <p className="page-label" style={{ marginBottom: "24px" }}>Standardized Coefficients</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {activeGroup.coefficients && Object.entries(activeGroup.coefficients)
                        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                        .map(([pred, coef]) => {
                          const maxCoef = Math.max(...Object.values(activeGroup.coefficients).map(Math.abs))
                          const barWidth = Math.abs(coef) / maxCoef * 100
                          const isPositive = coef >= 0
                          return (
                            <div key={pred}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                <span style={{ fontSize: "13px", color: "#9ca3af" }}>{predictorLabels[pred] || pred}</span>
                                <span style={{ fontSize: "13px", color: isPositive ? "#1FA607" : "#c40808", fontFamily: "Georgia, serif" }}>
                                  {isPositive ? "+" : ""}{coef.toFixed(3)}
                                </span>
                              </div>
                              <div style={{ height: "4px", background: "#1a1a1a", borderRadius: "2px" }}>
                                <div style={{
                                  height: "100%",
                                  width: `${barWidth}%`,
                                  background: isPositive ? "#1FA607" : "#c40808",
                                  borderRadius: "2px"
                                }} />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                </div>

                {/* Per-Club Correlations */}
                <div style={{ background: "#111111", border: "1px solid #1e1e1e", padding: "32px" }}>
                  <p className="page-label" style={{ marginBottom: "8px" }}>Per-Club Pearson Correlations</p>
                  <p style={{ fontSize: "13px", color: "#9ca3af", marginBottom: "24px" }}>
                    ✓ = statistically significant (p &lt; 0.05). Sorted by face angle correlation strength.
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table className="thresholds-table">
                      <thead>
                        <tr>
                          <th>Club</th>
                          <th>n</th>
                          <th>Club Path</th>
                          <th>Face Angle</th>
                          <th>Face to Path</th>
                          <th>Club Speed</th>
                          <th>Attack Angle</th>
                          <th>Smash Factor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeGroup.per_club_correlations &&
                          Object.entries(activeGroup.per_club_correlations)
                            .sort((a, b) => {
                              const rA = a[1].correlations?.face_angle?.r || 0
                              const rB = b[1].correlations?.face_angle?.r || 0
                              return Math.abs(rB) - Math.abs(rA)
                            })
                            .map(([club, clubData]) => (
                              <tr key={club}>
                                <td style={{ color: "#ffffff", fontFamily: "Georgia, serif" }}>{club}</td>
                                <td style={{ color: "#9ca3af" }}>{clubData.n}</td>
                                {["club_path", "face_angle", "face_to_path", "club_speed", "attack_angle", "smash_factor"].map(pred => {
                                  const corr = clubData.correlations?.[pred]
                                  if (!corr) return <td key={pred} style={{ color: "#9ca3af" }}>—</td>
                                  const color = corr.significant
                                    ? (corr.r > 0 ? "#1FA607" : "#c40808")
                                    : "#9ca3af"
                                  return (
                                    <td key={pred} style={{ color, fontFamily: "Georgia, serif" }}>
                                      {corr.significant ? "✓ " : ""}{corr.r > 0 ? "+" : ""}{corr.r.toFixed(3)}
                                    </td>
                                  )
                                })}
                              </tr>
                            ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Quality Score Methodology */}
            <div style={{
              background: "#111111",
              border: "1px solid #1e1e1e",
              borderLeft: "3px solid #1e1e1e",
              padding: "36px 32px",
              marginTop: "32px",
            }}>
              <p style={{ fontSize: "11px", color: "#c9a84c", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "16px" }}>
                Methodology — Quality Score
              </p>
              <p style={{ fontSize: "15px", color: "#9ca3af", lineHeight: "1.8" }}>
                Standardizing shot quality allows meaningful comparisons across clubs. Rather than measuring raw carry or lateral error, each shot was scored using its Euclidean distance from the intended target after normalizing carry and lateral deviations by each club's historical variability. This produces a club-independent quality score ranging from 0 to 100, allowing a 7-iron shot, pitching wedge, and driver to be compared on the same scale despite their vastly different expected distances and dispersions. That normalization makes cross-club statistical analysis possible and is a key methodological contribution of the project.
              </p>
              <p style={{ fontSize: "13px", fontFamily: "monospace", marginTop: "16px", color: "#c9a84c" }}>
                quality_distance = √(carry_z² + side_z²) &nbsp;&nbsp;|&nbsp;&nbsp; quality_score = 100 × e^(−d / 1.5)
              </p>
            </div>

            {/* Key Findings */}
            <p className="page-label" style={{ marginTop: "48px", marginBottom: "16px" }}>Key Findings (click for more details)</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "#1e1e1e", border: "1px solid #1e1e1e" }}>
              {findings.map(finding => {
                const isExpanded = expandedFinding === finding.number
                return (
                  <div
                    key={finding.number}
                    style={{
                      background: "#111111",
                      padding: "36px 32px",
                      cursor: isExpanded ? "default" : "pointer",
                      transition: "background 0.2s",
                      position: "relative"
                    }}
                    onClick={() => !isExpanded && setExpandedFinding(finding.number)}
                  >
                    {/* X button when expanded */}
                    {isExpanded && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedFinding(null)
                        }}
                        style={{
                          position: "absolute",
                          top: "24px",
                          right: "24px",
                          background: "none",
                          border: "none",
                          color: "#c9a84c",
                          fontSize: "18px",
                          cursor: "pointer",
                          padding: "0",
                          lineHeight: "1"
                        }}
                      >
                        ✕
                      </button>
                    )}

                    <p style={{ fontSize: "11px", color: "#c9a84c", letterSpacing: "0.15em", marginBottom: "12px" }}>
                      {finding.number}
                    </p>
                    <h3 style={{
                      fontSize: "18px",
                      fontWeight: "400",
                      color: "#ffffff",
                      fontFamily: "Georgia, serif",
                      marginBottom: isExpanded ? "20px" : "0",
                      paddingRight: isExpanded ? "32px" : "0"
                    }}>
                      {finding.title}
                    </h3>

                    {isExpanded && (
                      <>
                        <ul style={{ paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "10px", marginBottom: finding.conclusion ? "16px" : "0" }}>
                          {finding.bullets.map((bullet, i) => (
                            <li key={i} style={{ fontSize: "14px", color: "#9ca3af", lineHeight: "1.7", listStyleType: "disc" }}>
                              {bullet}
                            </li>
                          ))}
                        </ul>
                        {finding.conclusion && (
                          <p style={{ fontSize: "14px", color: "#c9a84c", lineHeight: "1.7", fontStyle: "italic", borderTop: "1px solid #1e1e1e", paddingTop: "12px", marginTop: "4px" }}>
                            {finding.conclusion}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------
// Sessions page
// ------------------------------------------------

function SessionsPage({ sessions, totalShots }) {
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
          <p className="page-subtitle">All {sessions.length} range sessions from August 2025 through present day.</p>
        </div>
        <div className="sessions-header-stats">
          <div className="sessions-stat">
            <span className="sessions-stat-number">{sessions.length}</span>
            <span className="sessions-stat-label">Sessions</span>
          </div>
          <div className="sessions-stat">
            <span className="sessions-stat-number">{totalShots.toLocaleString()}</span>
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

function UploadPage({ onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [apiKey, setApiKey] = useState("")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null) // { success: bool, message: string }
  const [dragOver, setDragOver] = useState(false)

  const handleFileSelect = (file) => {
    if (file && file.name.endsWith(".csv")) {
      setSelectedFile(file)
      setResult(null)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect(e.dataTransfer.files[0])
  }

  const handleUpload = () => {
    if (!selectedFile || !apiKey) return

    setUploading(true)
    setProgress(0)
    setResult(null)

    const formData = new FormData()
    formData.append("file", selectedFile)

    // Using XMLHttpRequest instead of fetch because fetch doesn't
    // expose upload progress events - XHR does via upload.onprogress
    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      setUploading(false)
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText)
        setResult({ success: true, message: `Session(s) added — ${response.rows_added} shots` })
        setSelectedFile(null)
        onUploadSuccess()
      } else {
        const errorText = xhr.responseText
        setResult({ success: false, message: `Upload failed: ${errorText}` })
      }
    }

    xhr.onerror = () => {
      setUploading(false)
      setResult({ success: false, message: "Upload failed: could not reach server" })
    }

    xhr.open("POST", `${API_BASE}/upload`)
    xhr.setRequestHeader("X-API-Key", apiKey)
    xhr.send(formData)
  }

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

          <div
            className="upload-dropzone"
            style={{ borderColor: dragOver ? "#c9a84c" : undefined, cursor: "pointer" }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("csv-file-input").click()}
          >
            <div style={{ fontSize: "32px", marginBottom: "16px", color: "#c9a84c" }}>↑</div>
            <p>{selectedFile ? selectedFile.name : "Drop Trackman CSV here"}</p>
            <small>or click to browse · .csv files only</small>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />
          </div>

          <div style={{ margin: "20px 0" }}>
            <input
              type="password"
              placeholder="API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#0a0a0a",
                border: "1px solid #1e1e1e",
                color: "#ffffff",
                fontFamily: "Georgia, serif"
              }}
            />
          </div>

          {uploading && (
            <div style={{ margin: "16px 0" }}>
              <p style={{ fontSize: "13px", color: "#c9a84c", marginBottom: "8px" }}>
                Uploading {progress}% Complete
              </p>
              <div style={{ height: "4px", background: "#1a1a1a", borderRadius: "2px" }}>
                <div style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: "#c9a84c",
                  borderRadius: "2px",
                  transition: "width 0.2s"
                }} />
              </div>
            </div>
          )}

          {result && (
            <p style={{
              fontSize: "14px",
              color: result.success ? "#1FA607" : "#c40808",
              marginTop: "12px",
              fontFamily: "Georgia, serif"
            }}>
              {result.success ? "✓ " : "✕ "}{result.message}
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              className="upload-submit"
              disabled={!selectedFile || !apiKey || uploading}
              onClick={handleUpload}
              style={{ opacity: (!selectedFile || !apiKey || uploading) ? 0.5 : 1 }}
            >
              {uploading ? "Uploading..." : "Upload Session →"}
            </button>
          </div>
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
  const [totalShots, setTotalShots] = useState(0)

  const fetchSessions = () => {
    fetch(`${API_BASE}/sessions`)
      .then(res => res.json())
      .then(data => setSessions(data))
      .catch(err => console.error("Failed to fetch sessions:", err))
  }

  const fetchShotCount = () => {
    fetch(`${API_BASE}/shots/count`)
      .then(res => res.json())
      .then(data => setTotalShots(data.total_shots))
      .catch(err => console.error("Failed to fetch shot count:", err))
  }

  useEffect(() => {
    fetchSessions()
    fetchShotCount()
  }, [])

  return (
    <div className="app">
      <Nav activePage={activePage} setActivePage={setActivePage} />
      {activePage === "overview" && <LandingPage sessions={sessions} totalShots={totalShots} setActivePage={setActivePage} />}
      {activePage === "metrics" && <ClubMetricsPage />}
      {activePage === "analysis" && <AnalysisPage />}
      {activePage === "sessions" && <SessionsPage sessions={sessions} totalShots={totalShots} />}
      {activePage === "upload" && <UploadPage onUploadSuccess={() => { fetchSessions(); fetchShotCount(); }} />}
    </div>
  )
}