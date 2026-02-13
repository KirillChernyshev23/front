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

export default function AnalyticsPage({ auth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard({ refresh = true } = {}) {
    setLoading(true);
    setError("");
    try {
      // При заходе на страницу — всегда свежие данные
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
    // все типы из DOC_TYPES (даже если count = 0)
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

    // типы, которые есть на бэке, но нет в DOC_TYPES
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
    const arr = data?.tags?.top_tags || [];
    return (Array.isArray(arr) ? arr : [])
      .filter((x) => x?.tag)
      .map((x) => ({ tag: String(x.tag), count: x.count || 0 }))
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 10);
  }, [data]);

  // для графика: короткие подписи (чтобы не ломать ось X)
  const topTagsChart = useMemo(() => {
    return topTags.map((t) => ({
      ...t,
      tagShort: t.tag.length > 18 ? t.tag.slice(0, 18) + "…" : t.tag,
    }));
  }, [topTags]);

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
                      <linearGradient
                        id="ecTypesGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#4f46e5"
                          stopOpacity={0.95}
                        />
                        <stop
                          offset="100%"
                          stopColor="#2563eb"
                          stopOpacity={0.9}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                      vertical={false}
                    />

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
                      <LabelList
                        dataKey="count"
                        position="insideMiddle"
                        offset={8}
                        fill="#ffffff"
                        fontSize={18}
                      />
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
                    <linearGradient
                      id="ecMonthsGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#22c55e"
                        stopOpacity={0.95}
                      />
                      <stop
                        offset="100%"
                        stopColor="#16a34a"
                        stopOpacity={0.9}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    vertical={false}
                  />

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

                  <Bar
                    dataKey="count"
                    name="Количество документов"
                    fill="url(#ecMonthsGradient)"
                    radius={[8, 8, 2, 2]}
                  >
                    <LabelList
                      dataKey="count"
                      position="insideMiddle"
                      offset={8}
                      fill="#ffffff"
                      fontSize={18}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Топ-10 тегов */}
          <section className="ec-analytics__section">
            <h3>Топ-10 тегов</h3>
            {topTagsChart.length === 0 ? (
              <p>Пока нет данных по тегам.</p>
            ) : (
              <div className="ec-analytics__chart-container">
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart
                    data={topTagsChart}
                    margin={{ top: 20, right: 20, left: 0, bottom: 70 }}
                    barCategoryGap={22}
                  >
                    <defs>
                      <linearGradient
                        id="ecTagsGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#f59e0b"
                          stopOpacity={0.95}
                        />
                        <stop
                          offset="100%"
                          stopColor="#d97706"
                          stopOpacity={0.9}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                      vertical={false}
                    />

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
                      labelFormatter={(_, idx) =>
                        topTagsChart[idx]?.tag || ""
                      }
                      cursor={{ fill: "rgba(245,158,11,0.06)" }}
                      contentStyle={{
                        borderRadius: 8,
                        borderColor: "#e5e7eb",
                        boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                      }}
                    />

                    <Bar
                      dataKey="count"
                      name="Количество"
                      fill="url(#ecTagsGradient)"
                      radius={[8, 8, 2, 2]}
                    >
                      <LabelList
                        dataKey="count"
                        position="insideMiddle"
                        offset={8}
                        fill="#ffffff"
                        fontSize={18}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
