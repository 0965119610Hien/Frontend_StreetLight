import geopandas as gpd
import folium
from folium.plugins import MarkerCluster
from datetime import datetime

# Đọc file dữ liệu lớn
gdf = gpd.read_file("my_street_lights_20260505_0357.geojson")   # ← thay tên file của bạn

print(f"Đang tạo bản đồ với {len(gdf)} cột đèn...")

# Tạo bản đồ trung tâm Đà Nẵng
m = folium.Map(location=[16.07, 108.21], zoom_start=14, tiles="CartoDB positron")

# Sử dụng MarkerCluster để hiển thị mượt khi dữ liệu nhiều
marker_cluster = MarkerCluster().add_to(m)

for idx, row in gdf.iterrows():
    image_url = row.get('source_pic', '')

    popup_html = f"""
    <b>Mapillary ID:</b> {row['mapillary_id']}<br>
    <b>Vĩ độ:</b> {row.geometry.y:.6f}<br>
    <b>Kinh độ:</b> {row.geometry.x:.6f}<br>
    <b>First seen:</b> {row.get('first_seen_at', 'N/A')}<br>
    <b>Ảnh:</b><br>
    <img src="{image_url}" width="200px" style="border-radius: 5px;">
    """
    
    folium.CircleMarker(
        location=[row.geometry.y, row.geometry.x],
        radius=5,
        popup=folium.Popup(popup_html, max_width=300),
        color='#FF4500',
        fill=True,
        fill_color='#FF4500',
        fill_opacity=0.8,
        weight=1
    ).add_to(marker_cluster)

# Thêm lớp heatmap (tùy chọn)
from folium.plugins import HeatMap
HeatMap([[row.geometry.y, row.geometry.x] for idx, row in gdf.iterrows()],
        radius=12, blur=8, max_zoom=15).add_to(folium.FeatureGroup(name='Heatmap').add_to(m))

folium.LayerControl().add_to(m)

# Lưu bản đồ
output_file = f"map_street_lights_danang_{datetime.now().strftime('%Y%m%d_%H%M')}.html"
m.save(output_file)

print(f"✅ Bản đồ đã được tạo thành công!")
print(f"Mở file sau để xem: {output_file}")