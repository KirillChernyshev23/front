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
} from "recharts";

// ===== DEMO TOGGLE =====
// Если хочешь посмотреть облако без бэка — поставь true
const FORCE_TAGS_DEMO = false;

// ===== DEMO DATA =====
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

// ---------- helpers: months ----------
function pad2(n) {
  return String(n).padStart(2, "0");
}

// "2025-12-01" / "2025-12" / ISO-date -> "YYYY-MM"
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

// детерминированный hash (чтобы “хаос” и цвета были стабильны)
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
  "#2563eb", // blue
  "#7c3aed", // violet
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
];

function TagCloud({ items }) {
  if (!items || !items.length) return null;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 14,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "14px 14px",
          alignItems: "center",
          alignContent: "flex-start",
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

              // кирпич
              padding: `${w.padY}px ${w.padX}px`,
              borderRadius: w.radius,
              fontSize: w.fontSize,
              fontWeight: w.fontWeight,
              lineHeight: 1,

              // ✅ полная заливка
              background: w.bg,
              color: w.fg,

              // ✅ чуть объёма
              border: "1px solid rgba(15,23,42,0.08)",
              boxShadow: w.shadow,

              // ✅ “хаос” без вращения
              transform: `translateY(${w.lift}px)`,
              transformOrigin: "center",

              userSelect: "none",
            }}
          >
            {w.tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage({ auth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard({ refresh = true } = {}) {
    setLoading(true);
    setError("");
    try {
      const res = refresh ? await api.refreshDashboard() : await api.getDashboard();
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
  const totalDocuments = totals.total_documents || 0;

  // ---------- ДАННЫЕ ДЛЯ ДИАГРАММЫ ПО ТИПАМ ----------
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

  // ---------- ДАННЫЕ ДЛЯ ДИАГРАММЫ ПО МЕСЯЦАМ (последние 6) ----------
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

  // ---------- ДАННЫЕ ДЛЯ ТОП-10 ТЕГОВ ----------
  const topTags = useMemo(() => {
    const arr = FORCE_TAGS_DEMO ? MOCK_TOP_TAGS : data?.tags?.top_tags || [];
    return (Array.isArray(arr) ? arr : [])
      .filter((x) => x?.tag)
      .map((x) => ({ tag: String(x.tag), count: x.count || 0 }))
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 10);
  }, [data]);

  const topTagsChart = useMemo(() => {
    return topTags.map((t) => ({
      ...t,
      tagShort: t.tag.length > 18 ? t.tag.slice(0, 18) + "…" : t.tag,
    }));
  }, [topTags]);

  // ---------- ОБЛАКО ТЕГОВ (кирпичики, линейная пропорция size ~ count) ----------
  const tagCloudItems = useMemo(() => {
    const src = FORCE_TAGS_DEMO ? MOCK_TOP_TAGS : data?.tags?.top_tags || [];

    const clean = (Array.isArray(src) ? src : [])
      .filter((x) => x?.tag)
      .map((x) => ({ tag: String(x.tag), count: Number(x.count || 0) }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 60);

    if (!clean.length) return [];

    // ✅ линейная пропорция: берём baseline = минимальный count в выборке
    // Тогда count в 3 раза больше => кирпич примерно в 3 раза больше
    const minCount = Math.max(1, clean[clean.length - 1].count);

    // чтобы совсем огромные не “сломали” страницу — оставим высокий предел
    // (3x, 4x, 5x будет сохраняться, если не упирается в cap)
    const MAX_K = 10;

    // базовые размеры (минимальный тег)
    const BASE_FONT = 16;
    const BASE_PAD_X = 14;
    const BASE_PAD_Y = 9;

    return clean.map((t) => {
      const h = hashString(t.tag);

      const kRaw = t.count / minCount; // ✅ строго пропорционально count
      const k = clamp(kRaw, 1, MAX_K);

      // размеры кирпича (всё линейно => “в 3 раза count -> в 3 раза size”)
      const fontSize = Math.round(BASE_FONT * k);
      const padX = Math.round(BASE_PAD_X * k);
      const padY = Math.round(BASE_PAD_Y * k);

      // немного хаоса без вращения
      const lift = ((h >>> 7) % 9) - 4; // -4..+4
      const radius = 12 + ((h >>> 16) % 18); // 12..29

      // цвета/градиент
      const c1 = CLOUD_PALETTE[h % CLOUD_PALETTE.length];
      const c2 = CLOUD_PALETTE[(h + 3) % CLOUD_PALETTE.length];
      const dir = (h % 3) === 0 ? "135deg" : (h % 3) === 1 ? "45deg" : "90deg";
      const bg = `linear-gradient(${dir}, ${c1}, ${c2})`;
      const fg = "rgba(255,255,255,0.97)";

      // тень чуть сильнее у больших
      const shadowAlpha = 0.12 + Math.min(0.12, (k - 1) * 0.02);
      const shadow = `0 10px 24px rgba(15,23,42,${shadowAlpha})`;

      // вес шрифта чуть растёт у крупных
      const fontWeight = k >= 3 ? 900 : k >= 2 ? 800 : 700;

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

  return (
    <div className="ec-page">
      <h2 className="ec-page__title">Статистика по документам</h2>

      {error && (
        <div className="ec-alert ec-alert--error">
          <div>{error}</div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => loadDashboard({ refresh: true })}
            disabled={loading}
            style={{ marginTop: "0.5rem" }}
          >
            Попробовать ещё раз
          </button>
        </div>
      )}

      {loading && !data && <p>Загружаем статистику…</p>}

      {data && (
        <>
          {/* Общее количество документов */}
          <section className="ec-analytics__section">
            <h3>Общее количество документов</h3>
            <div className="ec-analytics__totals">
              <div className="ec-analytics__card ec-analytics__card--big">
                <div className="ec-analytics__card-label">Всего в базе</div>
                <div className="ec-analytics__card-value ec-analytics__card-value--accent">
                  {totalDocuments}
                </div>
              </div>
            </div>
          </section>

          {/* Столбчатая диаграмма по типам */}
          <section className="ec-analytics__section">
            <h3>Документы по типам</h3>
            {byType.length === 0 ? (
              <p>Пока нет данных по типам документов.</p>
            ) : (
              <div className="ec-analytics__chart-container">
                <ResponsiveContainer width="100%" height={330}>
                  <BarChart
                    data={byType}
                    margin={{ top: 20, right: 20, left: 0, bottom: 40 }}
                    barCategoryGap={30}
                  >
                    <defs>
                      <linearGradient id="ecTypesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.9} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />

                    <XAxis
                      dataKey="typeLabel"
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={70}
                      tick={{ fill: "#4b5563", fontSize: 14 }}
                    />

                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#4b5563", fontSize: 12 }}
                      label={{
                        value: "Количество документов",
                        angle: -90,
                        position: "insideLeft",
                        offset: 10,
                        style: {
                          fill: "#6b7280",
                          fontSize: 14,
                          textAnchor: "middle",
                        },
                      }}
                    />

                    <Tooltip
                      cursor={{ fill: "rgba(37,99,235,0.04)" }}
                      contentStyle={{
                        borderRadius: 8,
                        borderColor: "#e5e7eb",
                        boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                      }}
                    />

                    <Bar
                      dataKey="count"
                      name="Количество документов"
                      fill="url(#ecTypesGradient)"
                      radius={[8, 8, 2, 2]}
                    >
                      <LabelList dataKey="count" position="insideMiddle" offset={8} fill="#ffffff" fontSize={18} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Столбчатая диаграмма по месяцам (последние 6) */}
          <section className="ec-analytics__section">
            <h3>Динамика загрузки по месяцам (последние 6)</h3>
            <div className="ec-analytics__chart-container">
              <ResponsiveContainer width="100%" height={330}>
                <BarChart
                  data={byMonth}
                  margin={{ top: 20, right: 20, left: 0, bottom: 40 }}
                  barCategoryGap={25}
                >
                  <defs>
                    <linearGradient id="ecMonthsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#16a34a" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />

                  <XAxis
                    dataKey="monthLabel"
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={70}
                    tick={{ fill: "#4b5563", fontSize: 14 }}
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#4b5563", fontSize: 14 }}
                    label={{
                      value: "Количество документов",
                      angle: -90,
                      position: "insideLeft",
                      offset: 10,
                      style: {
                        fill: "#6b7280",
                        fontSize: 12,
                        textAnchor: "middle",
                      },
                    }}
                  />

                  <Tooltip
                    cursor={{ fill: "rgba(16,185,129,0.04)" }}
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: "#e5e7eb",
                      boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                    }}
                  />

                  <Bar dataKey="count" name="Количество документов" fill="url(#ecMonthsGradient)" radius={[8, 8, 2, 2]}>
                    <LabelList dataKey="count" position="insideMiddle" offset={8} fill="#ffffff" fontSize={18} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Топ-10 тегов + облако */}
          <section className="ec-analytics__section">
            <h3>Топ-10 тегов</h3>
            {topTagsChart.length === 0 ? (
              <p>Пока нет данных по тегам.</p>
            ) : (
              <>
                <div className="ec-analytics__chart-container">
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart
                      data={topTagsChart}
                      margin={{ top: 20, right: 20, left: 0, bottom: 70 }}
                      barCategoryGap={22}
                    >
                      <defs>
                        <linearGradient id="ecTagsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#d97706" stopOpacity={0.9} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />

                      <XAxis
                        dataKey="tagShort"
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={80}
                        tick={{ fill: "#4b5563", fontSize: 13 }}
                      />

                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "#4b5563", fontSize: 12 }}
                        label={{
                          value: "Количество",
                          angle: -90,
                          position: "insideLeft",
                          offset: 10,
                          style: {
                            fill: "#6b7280",
                            fontSize: 12,
                            textAnchor: "middle",
                          },
                        }}
                      />

                      <Tooltip
                        formatter={(v) => [v, "Количество"]}
                        labelFormatter={(_, idx) => topTagsChart[idx]?.tag || ""}
                        cursor={{ fill: "rgba(245,158,11,0.06)" }}
                        contentStyle={{
                          borderRadius: 8,
                          borderColor: "#e5e7eb",
                          boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                        }}
                      />

                      <Bar dataKey="count" name="Количество" fill="url(#ecTagsGradient)" radius={[8, 8, 2, 2]}>
                        <LabelList dataKey="count" position="insideMiddle" offset={8} fill="#ffffff" fontSize={18} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Облако тегов */}
                <div style={{ marginTop: 12 }}>
                  <h4 style={{ margin: "0 0 10px 0" }}>Облако тегов</h4>
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