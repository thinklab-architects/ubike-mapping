# YouBike Mapbox Timeline

使用 Mapbox GL JS 將 `csv/` 資料夾內的 YouBike 站點資料以時間軸方式呈現。拖曳時間軸即可切換不同十分鐘的車輛數，並可在地圖上查看各站點的可借車輛。

## 快速開始

1. 申請或準備 Mapbox Access Token，編輯 `main.js` 中的 `MAPBOX_ACCESS_TOKEN` 常數。
2. 將每日的 YouBike CSV 放在 `csv/` 資料夾，並在 `csv/manifest.json` 新增對應的 `date` 與檔名。
3. 將整個專案上傳到 GitHub (例如 `ubike_mapping` 倉庫)，啟用 GitHub Pages 即可透過瀏覽器瀏覽互動式地圖。

> 若需要重新建立 manifest，可在本機執行簡單的 node / python 腳本讀取 `csv/` 內所有檔名後輸出成 JSON；上傳到 GitHub 前記得更新。

## 資料需求

CSV 檔案需包含下列欄位：

- `sno`, `sna`, `sarea`, `ar`, `lat`, `lng`, `tot`, `bemp`, `act`
- 之後每個欄位為 `HH:MM` 格式 (10 分鐘區間) 的可借車輛數。

## 客製化

- 想調整顏色或點大小，可編輯 `main.js` 中圖層的 `circle-radius` 與 `circle-color` 表達式。
- 版面樣式在 `style.css` 內，可依需求改為其他主題。
- 如需顯示更多站點資訊，可修改 GeoJSON properties 與 tooltip 標示文字。

## 發佈到 GitHub

1. 初始化 git 倉庫並推送到 GitHub。
2. 在 GitHub 的 repository 設定中啟用 Pages，來源選擇 `main` 分支的根目錄。
3. 等待 Pages 編譯完成後，即可使用自動生成的網址存取地圖。

