// src/pages/AnalyticsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { DOC_TYPES, backendTypeToKind } from "../constants/docTypes";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ===== DEMO TOGGLE =====
const FORCE_TAGS_DEMO = false;

const MOCK_TOP_TAGS = [
  { tag: "интересно", count: 120 },
  { tag: "удобно", count: 70 },
  { tag: "доступно", count: 60 },
  { tag: "современно", count: 55 },
  { tag: "понятно", count: 48 },
  { tag: "весело", count: 45 },
  { tag: "простота", count: 40 },
  { tag: "соревновательно", count: 38 },
  { tag: "быстро", count: 36 },
  { tag: "проверка знаний", count: 34 },
  { tag: "викторины", count: 32 },
  { tag: "команда", count: 28 },
  { tag: "много тестов", count: 26 },
  { tag: "оценки", count: 25 },
  { tag: "мемы", count: 22 },
  { tag: "опросы", count: 20 },
  { tag: "интересная подача", count: 19 },
  { tag: "узнать новое", count: 18 },
  { tag: "классная программа", count: 17 },
  { tag: "времяпрепровождение", count: 15 },
];

// ---------- Палитра ----------
const PIE_COLORS = [
  "#1a1a2e", "#c4956a", "#4f7cac", "#6b7280", "#b07d52",
  "#374151", "#8b5e34", "#5b8fb9", "#9ca3af", "#d4a574",
];

const TAG_GRADIENT = ["#c4956a", "#b07d52"];
const TYPE_GRADIENT = ["#1a1a2e", "#374151"];
const MONTH_GRADIENT = ["#4f7cac", "#3a6a9a"];

// ---------- helpers: months ----------
function pad2(n) {
  return String(n).padStart(2, "0");
}

function monthKeyFromLabel(label) {
  if (!label) return null;
  const m = String(label).match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  const d = new Date(label);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  }
  return null;
}

function monthLabelFromDate(date) {
  const month = date.toLocaleString("ru-RU", { month: "long" });
  const year = date.getFullYear();
  const curYear = new Date().getFullYear();
  return year === curYear ? month : `${month} ${year}`;
}

function lastNMonths(n = 6) {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), 1);
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    arr.push({ key, monthLabel: monthLabelFromDate(d) });
  }
  return arr;
}

// ---------- helpers: tag cloud ----------
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function hashString(str) {
  let h = 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const CLOUD_PALETTE = [
  "#1a1a2e", "#c4956a", "#4f7cac", "#b07d52",
  "#374151", "#6b7280", "#8b5e34", "#5b8fb9",
];

function TagCloud({ items }) {
  if (!items || !items.length) return null;

  return (
    <div
      style={{
        border: "1px solid rgba(26,26,46,0.08)",
        borderRadius: 14,
        padding: 18,
        background: "rgba(255,255,255,0.6)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px 12px",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        {items.map((w) => (
          <span
            key={w.tag}
            title={`${w.tag} — ${w.count}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              whiteSpace: "nowrap",
              padding: `${w.padY}px ${w.padX}px`,
              borderRadius: w.radius,
              fontSize: w.fontSize,
              fontWeight: w.fontWeight,
              lineHeight: 1,
              background: w.bg,
              color: w.fg,
              border: "1px solid rgba(26,26,46,0.06)",
              boxShadow: w.shadow,
              transform: `translateY(${w.lift}px)`,
              userSelect: "none",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            {w.tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Custom tooltip ----------
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(26,26,46,0.1)",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "0 8px 24px rgba(26,26,46,0.1)",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4, color: "#1a1a2e" }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: "#6b7280" }}>
          {p.name}: <b style={{ color: "#1a1a2e" }}>{p.value}</b>
        </div>
      ))}
    </div>
  );
}

// ---------- Stat card ----------
function StatCard({ label, value, accent = false }) {
  return (
    <div
      style={{
        padding: "20px 24px",
        borderRadius: 14,
        background: accent
          ? "linear-gradient(135deg, #1a1a2e, #2a2a40)"
          : "rgba(255,255,255,0.7)",
        border: accent ? "none" : "1px solid rgba(26,26,46,0.08)",
        backdropFilter: accent ? "none" : "blur(8px)",
        boxShadow: accent
          ? "0 8px 24px rgba(26,26,46,0.15)"
          : "0 2px 8px rgba(26,26,46,0.04)",
        minWidth: 160,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: accent ? "rgba(255,255,255,0.6)" : "#6b7280",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 32,
          fontWeight: 400,
          color: accent ? "#fff" : "#1a1a2e",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ===================== Main component =====================

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard({ refresh = true } = {}) {
    setLoading(true);
    setError("");
    try {
      const res = refresh
        ? await api.refreshDashboard()
        : await api.getDashboard();
      setData(res);
    } catch (err) {
      setError(err?.message || "Не удалось загрузить статистику");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard({ refresh: true });
  }, []);

  const totals = data?.totals || {};
  const totalDocuments = totals.processed_documents || 0;

  // ---------- По типам ----------
  const rawByType = data?.classification?.by_type || [];

  const countsByLabel = useMemo(() => {
    const m = new Map();
    rawByType.forEach((item) => {
      if (!item) return;
      const label = item.label || "";
      const count = item.count || 0;
      if (!label) return;
      m.set(label, (m.get(label) || 0) + count);
    });
    return m;
  }, [rawByType]);

  const byType = useMemo(() => {
    const arr = Object.entries(DOC_TYPES).map(([kindKey, cfg]) => {
      const backendLabel = cfg.backendType || cfg.label || kindKey;
      const count = countsByLabel.get(backendLabel) || 0;
      return {
        kind: kindKey,
        rawLabel: backendLabel,
        typeLabel: cfg.label || backendLabel || "(без типа)",
        count,
      };
    });

    rawByType.forEach((item) => {
      if (!item) return;
      const label = item.label || "";
      if (!label) return;
      const already = arr.some((t) => t.rawLabel === label);
      if (already) return;
      const fallbackKind = backendTypeToKind(label);
      arr.push({
        kind: fallbackKind,
        rawLabel: label,
        typeLabel: label,
        count: item.count || 0,
      });
    });

    return arr;
  }, [countsByLabel, rawByType]);

  // Данные для pie chart
  const pieData = useMemo(() => {
    return byType.filter((t) => t.count > 0);
  }, [byType]);

  // ---------- По месяцам ----------
  const rawByMonth = data?.ingestion?.documents_by_month || [];

  const byMonth = useMemo(() => {
    const monthMap = new Map();
    rawByMonth.forEach((it) => {
      const key = monthKeyFromLabel(it?.label);
      if (!key) return;
      monthMap.set(key, (monthMap.get(key) || 0) + (it?.count || 0));
    });
    const months = lastNMonths(6);
    return months.map((m) => ({
      key: m.key,
      monthLabel: m.monthLabel,
      count: monthMap.get(m.key) || 0,
    }));
  }, [rawByMonth]);

  // ---------- Топ-10 тегов ----------
  const topTags = useMemo(() => {
    const arr = FORCE_TAGS_DEMO
      ? MOCK_TOP_TAGS
      : data?.tags?.top_tags || [];
    return (Array.isArray(arr) ? arr : [])
      .filter((x) => x?.tag)
      .map((x) => ({ tag: String(x.tag), count: x.count || 0 }))
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 10);
  }, [data]);

  // ---------- Облако тегов ----------
  const tagCloudItems = useMemo(() => {
    const src = FORCE_TAGS_DEMO
      ? MOCK_TOP_TAGS
      : data?.tags?.top_tags || [];

    const clean = (Array.isArray(src) ? src : [])
      .filter((x) => x?.tag)
      .map((x) => ({ tag: String(x.tag), count: Number(x.count || 0) }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 60);

    if (!clean.length) return [];

    const minCount = Math.max(1, clean[clean.length - 1].count);
    const MAX_K = 8;
    const BASE_FONT = 15;
    const BASE_PAD_X = 14;
    const BASE_PAD_Y = 8;

    return clean.map((t) => {
      const h = hashString(t.tag);
      const kRaw = t.count / minCount;
      const k = clamp(kRaw, 1, MAX_K);

      const fontSize = Math.round(BASE_FONT * k);
      const padX = Math.round(BASE_PAD_X * k);
      const padY = Math.round(BASE_PAD_Y * k);
      const lift = ((h >>> 7) % 7) - 3;
      const radius = 10 + ((h >>> 16) % 14);

      const color = CLOUD_PALETTE[h % CLOUD_PALETTE.length];
      const bg = color;
      const fg = "rgba(255,255,255,0.95)";

      const shadowAlpha = 0.08 + Math.min(0.1, (k - 1) * 0.015);
      const shadow = `0 6px 20px rgba(26,26,46,${shadowAlpha})`;
      const fontWeight = k >= 3 ? 800 : k >= 2 ? 700 : 600;

      return {
        ...t,
        fontSize,
        padX,
        padY,
        radius,
        lift,
        bg,
        fg,
        shadow,
        fontWeight,
      };
    });
  }, [data]);

  // ---------- Сводка по типам для карточек ----------
  const typeStats = useMemo(() => {
    return byType.filter((t) => t.count > 0).sort((a, b) => b.count - a.count);
  }, [byType]);

  return (
    <div style={{ padding: "8px 0", maxWidth: 1100, margin: "0 auto" }}>
      <h2
        style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 28,
          fontWeight: 400,
          margin: "0 0 24px",
        }}
      >
        Статистика
      </h2>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 20,
            color: "#b91c1c",
            fontSize: 14,
          }}
        >
          <div>{error}</div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => loadDashboard({ refresh: true })}
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            Попробовать ещё раз
          </button>
        </div>
      )}

      {loading && !data && (
        <p style={{ color: "#6b7280" }}>Загружаем статистику…</p>
      )}

      {data && (
        <>
          {/* ========== Карточки ========== */}
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              marginBottom: 28,
            }}
          >
            <StatCard
              label="Всего документов"
              value={totalDocuments}
              accent
            />
            {typeStats.slice(0, 4).map((t) => (
              <StatCard
                key={t.kind}
                label={t.typeLabel}
                value={t.count}
              />
            ))}
          </div>

          {/* ========== Типы: pie + bar ========== */}
          <section style={{ marginBottom: 28 }}>
            <h3
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: 20,
                fontWeight: 400,
                margin: "0 0 14px",
              }}
            >
              Документы по типам
            </h3>

            {byType.length === 0 ? (
              <p style={{ color: "#6b7280" }}>Пока нет данных.</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "280px 1fr",
                  gap: 16,
                  alignItems: "start",
                }}
              >
                {/* Pie chart */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(26,26,46,0.08)",
                    borderRadius: 14,
                    padding: "16px 8px",
                  }}
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="count"
                        nameKey="typeLabel"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={50}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {pieData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Легенда */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      padding: "0 12px",
                    }}
                  >
                    {pieData.map((t, i) => (
                      <div
                        key={t.kind}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            background:
                              PIE_COLORS[i % PIE_COLORS.length],
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: "#6b7280", flex: 1 }}>
                          {t.typeLabel}
                        </span>
                        <b style={{ color: "#1a1a2e" }}>{t.count}</b>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bar chart */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(26,26,46,0.08)",
                    borderRadius: 14,
                    padding: 16,
                  }}
                >
                  <ResponsiveContainer width="100%" height={380}>
                    <BarChart
                      data={byType}
                      margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
                      barCategoryGap={20}
                    >
                      <defs>
                        <linearGradient id="typeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={TYPE_GRADIENT[0]} />
                          <stop offset="100%" stopColor={TYPE_GRADIENT[1]} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,26,46,0.06)" vertical={false} />
                      <XAxis
                        dataKey="typeLabel"
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={80}
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="count"
                        name="Документов"
                        fill="url(#typeGrad)"
                        radius={[6, 6, 0, 0]}
                      >
                        <LabelList
                          dataKey="count"
                          position="insideTop"
                          offset={-20}
                          fill="#1a1a2e"
                          fontSize={13}
                          fontWeight={700}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>

          {/* ========== Динамика по месяцам ========== */}
          <section style={{ marginBottom: 28 }}>
            <h3
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: 20,
                fontWeight: 400,
                margin: "0 0 14px",
              }}
            >
              Динамика загрузки за последние 6 месяцев
            </h3>
            <div
              style={{
                background: "rgba(255,255,255,0.7)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(26,26,46,0.08)",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={byMonth}
                  margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                  barCategoryGap={25}
                >
                  <defs>
                    <linearGradient id="monthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={MONTH_GRADIENT[0]} />
                      <stop offset="100%" stopColor={MONTH_GRADIENT[1]} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,26,46,0.06)" vertical={false} />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fill: "#6b7280", fontSize: 13 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="count"
                    name="Документов"
                    fill="url(#monthGrad)"
                    radius={[6, 6, 0, 0]}
                  >
                    <LabelList
                      dataKey="count"
                      position="top"
                      offset={6}
                      fill="#1a1a2e"
                      fontSize={14}
                      fontWeight={700}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ========== Теги: горизонтальный бар + облако ========== */}
          <section style={{ marginBottom: 28 }}>
            <h3
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: 20,
                fontWeight: 400,
                margin: "0 0 14px",
              }}
            >
              Топ-10 тегов
            </h3>

            {topTags.length === 0 ? (
              <p style={{ color: "#6b7280" }}>Пока нет данных по тегам.</p>
            ) : (
              <>
                {/* Горизонтальная диаграмма — теги читаются полностью */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(26,26,46,0.08)",
                    borderRadius: 14,
                    padding: 16,
                  }}
                >
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(300, topTags.length * 42)}
                  >
                    <BarChart
                      data={topTags}
                      layout="vertical"
                      margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
                      barCategoryGap={12}
                    >
                      <defs>
                        <linearGradient id="tagGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={TAG_GRADIENT[0]} />
                          <stop offset="100%" stopColor={TAG_GRADIENT[1]} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,26,46,0.06)" horizontal={false} />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="tag"
                        width={200}
                        tick={{ fill: "#374151", fontSize: 13 }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="count"
                        name="Количество"
                        fill="url(#tagGrad)"
                        radius={[0, 6, 6, 0]}
                      >
                        <LabelList
                          dataKey="count"
                          position="right"
                          offset={8}
                          fill="#1a1a2e"
                          fontSize={13}
                          fontWeight={700}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Облако тегов */}
                <div style={{ marginTop: 16 }}>
                  <h4
                    style={{
                      fontFamily: "'DM Serif Display', Georgia, serif",
                      fontSize: 17,
                      fontWeight: 400,
                      margin: "0 0 10px",
                    }}
                  >
                    Облако тегов
                  </h4>
                  <TagCloud items={tagCloudItems} />
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}