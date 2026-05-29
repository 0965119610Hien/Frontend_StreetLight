import { useCallback, useEffect, useMemo, useState } from "react";
import "./index.css";

// --- Types ---
type ApiResponse = { sequences?: ApiSequence[] };
type ApiSequence = { sequence_id: string; images?: ApiImage[] };
type ApiImage = {
  image_id: string;
  thumbnail_url: string;
  camera_lat: number;
  camera_lon: number;
  uploaded_at?: string;
  street_lights?: ApiLight[];
};
type ApiLight = {
  light_id: string;
  real_lat: number | null;
  real_lon: number | null;
  bounding_box?: { x: number; y: number; w: number; h: number };
};

type MapPoint = {
  lightId: string;
  lat: number;
  lon: number;
  imageUrl: string;
  uploadedAt: string;
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
};

const remoteApiUrl = "https://67ba-14-233-172-40.ngrok-free.app/api/streetlights";
const proxyApiUrl = "/api/streetlights";

function getFetchUrl(apiUrl: string) {
  if (typeof window === "undefined") return apiUrl;
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return isLocalhost ? proxyApiUrl : apiUrl;
}

function resolveImageUrl(thumbnailUrl: string, apiUrl: string) {
  if (!thumbnailUrl || thumbnailUrl === "nan") return "";
  
  // LOG RA CONSOLE ĐỂ KIỂM TRA ĐƯỜNG DẪN
  console.log("Original URL:", thumbnailUrl); 
  
  // Thử kiểm tra xem URL có cần đường dẫn gốc không
  const isAbsolute = thumbnailUrl.startsWith('http');
  const finalUrl = isAbsolute ? thumbnailUrl : `${window.location.origin}${thumbnailUrl}`;
  
  console.log("Resolved URL:", finalUrl);
  return finalUrl;
}

function extractPoints(data: ApiResponse, apiUrl: string): MapPoint[] {
  const points: MapPoint[] = [];
  (data.sequences ?? []).forEach((sequence) => {
    (sequence.images ?? []).forEach((image) => {
      (image.street_lights ?? []).forEach((light) => {
        const hasReal = light.real_lat !== null && light.real_lon !== null;
        const box = light.bounding_box || { x: 0, y: 0, w: 0, h: 0 };
        points.push({
          lightId: light.light_id,
          lat: hasReal ? light.real_lat! : image.camera_lat,
          lon: hasReal ? light.real_lon! : image.camera_lon,
          imageUrl: resolveImageUrl(image.thumbnail_url, apiUrl),
          uploadedAt: image.uploaded_at ?? "-",
          bboxX: box.x, bboxY: box.y, bboxW: box.w, bboxH: box.h,
        });
      });
    });
  });
  return points;
}

function buildMapHtml(points: MapPoint[]) {
  const markers = points
    .map((point, index) => {
      const hasImage = Boolean(point.imageUrl);
      const hasBox = point.bboxW > 0 && point.bboxH > 0;
      
      // 1. Tạo chuỗi HTML an toàn
      const imageHtml = hasImage
        ? `<div style="position:relative; width:200px; border:1px solid #ccc; margin-top:5px;">
             <img src="${point.imageUrl}" width="200px" style="display:block;" />
             ${hasBox ? `<div style="position:absolute; left:${(point.bboxX * 100).toFixed(2)}%; top:${(point.bboxY * 100).toFixed(2)}%; width:${(point.bboxW * 100).toFixed(2)}%; height:${point.bboxH * 100}%; border:2px solid #FF4500; box-sizing:border-box; pointer-events:none;"></div>` : ""}
           </div>`
        : "<div>Khong co anh</div>";

      // 2. Định nghĩa nội dung Popup trực tiếp vào biến trong JS
      // Chúng ta thoát các dấu nháy đơn để không bị lỗi cú pháp JS
      const popupContent = `
        <div style='min-width: 200px;'>
          <b>Mapillary ID:</b> ${point.lightId}<br>
          <b>Vĩ độ:</b> ${point.lat.toFixed(6)}<br>
          <b>Kinh độ:</b> ${point.lon.toFixed(6)}<br>
          <b>Thời gian:</b> ${point.uploadedAt}<br>
          <b>Ảnh:</b><br>${imageHtml}
        </div>
      `;

      return `
        (function() {
          var marker = L.circleMarker([${point.lat}, ${point.lon}], { radius: 5, color: "#FF4500" }).addTo(markerCluster);
          marker.bindPopup(\`${popupContent}\`);
        })();
      `;
    })
    .join("\n");

  const heatPoints = points.map(p => `[${p.lat}, ${p.lon}]`).join(",");

  return `<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/leaflet.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.1.0/MarkerCluster.css" />
    <style>html, body, #map { height: 100%; margin: 0; }</style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/leaflet.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.1.0/leaflet.markercluster.js"></script>
    <script src="https://cdn.jsdelivr.net/gh/python-visualization/folium@main/folium/templates/leaflet_heat.min.js"></script>
    <script>
      var map = L.map("map").setView([16.07, 108.21], 14);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
      var markerCluster = L.markerClusterGroup();
      ${markers}
      markerCluster.addTo(map);
      var heat = L.heatLayer([${heatPoints}], { radius: 12, blur: 8 }).addTo(map);
    </script>
  </body>
</html>`;
}

function App() {
  const [apiUrl, setApiUrl] = useState(remoteApiUrl);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const handleReload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(getFetchUrl(apiUrl), { headers: { "ngrok-skip-browser-warning": "true" } });
      const data = await response.json();
      setPoints(extractPoints(data, apiUrl));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [apiUrl]);

  useEffect(() => { handleReload(); }, [handleReload]);

  return (
    <div className="app">
      <header className="topbar">
        <h1>Street Light Map</h1>
        <button onClick={handleReload} disabled={loading}>{loading ? "Dang tai..." : "Tai lai"}</button>
      </header>
      <main className="map-shell">
        <iframe key={points.length} className="map-frame" srcDoc={buildMapHtml(points)} title="Map" />
      </main>
    </div>
  );
}

export default App;