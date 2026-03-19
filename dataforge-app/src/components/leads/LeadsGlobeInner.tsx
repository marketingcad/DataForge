"use client";

import { useEffect, useRef } from "react";
import type { GlobePoint } from "@/lib/leads/locations";

interface Props {
  points: GlobePoint[];
}

export default function LeadsGlobeInner({ points }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<unknown>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let root: any = null;
    let cancelled = false;

    (async () => {
      const am5 = await import("@amcharts/amcharts5");
      const am5map = await import("@amcharts/amcharts5/map");
      const am5geodata_worldLow = (await import("@amcharts/amcharts5-geodata/worldLow")).default;
      const am5themes_Animated = (await import("@amcharts/amcharts5/themes/Animated")).default;

      if (cancelled || !chartRef.current) return;

      root = am5.Root.new(chartRef.current);
      rootRef.current = root;

      root.setThemes([am5themes_Animated.new(root)]);

      const chart = root.container.children.push(
        am5map.MapChart.new(root, {
          projection: am5map.geoOrthographic(),
          panX: "rotateX",
          panY: "rotateY",
          wheelY: "none",
          minZoomLevel: 1,
          maxZoomLevel: 2.2,
          centerX: am5.percent(50),
          centerY: am5.percent(50),
          x: am5.percent(50),
          y: am5.percent(50),
        })
      );

      chart.seriesContainer.setAll({
        width: am5.percent(100),
        height: am5.percent(100),
      });

      // Ocean background
      const backgroundSeries = chart.series.push(
        am5map.MapPolygonSeries.new(root, {})
      );
      backgroundSeries.mapPolygons.template.setAll({
        fill: am5.color(0x4a90d9),
        fillOpacity: 0.15,
        strokeOpacity: 0,
      });
      backgroundSeries.data.push({
        geometry: am5map.getGeoRectangle(90, 180, -90, -180),
      });

      // Countries
      const polygonSeries = chart.series.push(
        am5map.MapPolygonSeries.new(root, {
          geoJSON: am5geodata_worldLow,
        })
      );
      polygonSeries.mapPolygons.template.setAll({
        fill: am5.color(0x374151),
        stroke: am5.color(0x1f2937),
        strokeWidth: 0.5,
        fillOpacity: 0.9,
        tooltipText: "{name}",
      });
      polygonSeries.mapPolygons.template.states.create("hover", {
        fill: am5.color(0x4b5563),
      });

      // Lead dots
      const pointSeries = chart.series.push(
        am5map.MapPointSeries.new(root, {
          latitudeField: "lat",
          longitudeField: "long",
        })
      );

      pointSeries.bullets.push(function () {
        const maxCount = Math.max(...points.map((p) => p.count), 1);

        const circle = am5.Circle.new(root!, {
          radius: 0, // will be set per data item
          fill: am5.color(0xF54927),
          fillOpacity: 0.85,
          stroke: am5.color(0xff7a5c),
          strokeWidth: 1,
          tooltipText: "{name}\n{count} lead{count}",
          cursorOverStyle: "pointer",
        });

        circle.adapters.add("radius", function (_radius, target) {
          const ctx = target.dataItem?.dataContext as { count?: number } | undefined;
          const count = ctx?.count ?? 1;
          return Math.max(4, Math.min(14, 4 + (count / maxCount) * 10));
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        circle.events.on("click", function (ev: any) {
          const data = ev.target.dataItem?.dataContext as { long: number; lat: number } | undefined;
          if (!data) return;
          dotClicked = true;
          rotationAnimation?.stop();
          chart.animate({ key: "rotationX", to: -data.long, duration: 1000, easing: am5.ease.out(am5.ease.cubic) });
          chart.animate({ key: "rotationY", to: -data.lat,  duration: 1000, easing: am5.ease.out(am5.ease.cubic) });
          chart.animate({ key: "zoomLevel", to: 1.8,        duration: 1000, easing: am5.ease.out(am5.ease.cubic) });
          setTimeout(() => { dotClicked = false; }, 1200);
        });

        return am5.Bullet.new(root!, { sprite: circle });
      });

      pointSeries.data.setAll(points);

      // Auto-rotation
      let rotationAnimation = chart.animate({
        key: "rotationX",
        from: 0,
        to: 360,
        duration: 60000,
        loops: Infinity,
      });

      let dotClicked = false;

      chart.chartContainer.events.on("pointerdown", () => {
        rotationAnimation?.stop();
      });

      chart.chartContainer.events.on("pointerup", () => {
        if (dotClicked) return;
        rotationAnimation = chart.animate({
          key: "rotationX",
          from: chart.get("rotationX") ?? 0,
          to: (chart.get("rotationX") ?? 0) + 360,
          duration: 60000,
          loops: Infinity,
        });
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chart.chartContainer.events.on("click", function (ev: any) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(ev.target as any).dataItem) {
          chart.animate({ key: "zoomLevel", to: 1, duration: 800 });
          rotationAnimation = chart.animate({
            key: "rotationX",
            from: chart.get("rotationX") ?? 0,
            to: (chart.get("rotationX") ?? 0) + 360,
            duration: 60000,
            loops: Infinity,
          });
        }
      });

      chart.appear(1000, 100);
    })();

    return () => {
      cancelled = true;
      root?.dispose();
    };
  }, [points]);

  return (
    <div className="rounded-2xl bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold">Lead Locations</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {points.length} unique location{points.length !== 1 ? "s" : ""} · click a dot to zoom · drag to rotate
          </p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
          {points.reduce((s, p) => s + p.count, 0).toLocaleString()} leads mapped
        </span>
      </div>
      <div ref={chartRef} style={{ width: "100%", height: 420 }} />
    </div>
  );
}
