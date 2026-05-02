# 🫒 PROJECT SPEC — Hack The Harvest · Subject 01
### Intelligent Mapping of Tunisian Olive Groves
**9h30 · 3 people · GTX 1650 · Next.js + FastAPI + Docker + WSL**

---

> **Strategic Warning — Read this first.**
> You have 23 parcels. That is too few to train a reliable U-Net. The jury evaluates on **real metrics** (IoU ≥ 0.65, F1 ≥ 0.70). This spec assumes you are aware of this risk and includes concrete mitigation plans at every step. Do not skip any "Risk" section.

---

## 👥 Roles & Responsibilities

| Person | Role | Owns |
|---|---|---|
| **P1** | ML Engineer | Everything touching models, features, metrics |
| **P2** | Backend Engineer | FastAPI, data pipeline, Sentinel cache |
| **P3** | Frontend Engineer | Map interface, UX, export |

---

## ⏱️ Hour-by-Hour Timeline

### HOUR 0–1 : Setup & Alignment (All together)

**What you do manually :**
- Extract and inspect the full EZZAYRA data pack — count files, verify labels file is present
- Verify that `nvidia-smi` works inside WSL2 **before** starting Docker
- Open GEE Code Editor and confirm the account is active
- Agree on the **fixed demo zone** : a Sfax area of approximately 50 km²
  - Suggestion : southern Sfax area (El Amra / Agareb) — known high concentration of olive groves
- P2 starts the skeleton API returning mock data so P3 can work without waiting on P1

**Hour 1 deliverable :** Docker compose up, API responds with mock data, Leaflet map renders

---

### HOUR 1–2 : Data Preparation (P1) + Frontend Base (P3) + Sentinel Setup (P2)

#### P1 — Data Inspection & Preparation

**What you do manually :**
- Open the separate labels file and join it to the 23 EZZAYRA parcels by ID
- Manually verify the class distribution :
  - How many parcels are extensive / intensive / hyper-intensive?
  - If any class has fewer than 3 parcels → **critical decision** : merge it with the nearest class or activate Plan B for classification
- Convert coordinates from EZZAYRA format `{lat, lng}` to standard GeoJSON `[lng, lat]`
  - **Warning :** EZZAYRA uses `lat/lng`, GeoJSON expects `lng/lat` — this inversion is mandatory or all polygons will render in the ocean

**What the tool does :**
- GEE Python SDK : for each polygon, extracts Sentinel-2 L2A bands (B2, B3, B4, B8, B11) for the May–June period of 2024 or 2025

**Data risk :** If some parcels are partially cloud-covered in May–June, you will need to extend to April or July. Visually verify in GEE before training.

---

#### P2 — Sentinel Pipeline & Cache

**What you do manually :**
- Create a dedicated GEE project for the hackathon
- Precisely select the Sfax demo zone and note its exact coordinates
- Launch Sentinel download for the 23 parcels AND the Sfax demo zone **in parallel** — do not wait for one to finish before starting the other

**Tools to use :**
- Google Earth Engine (account already active ✅)
- `geemap` — Python library wrapping GEE for easy export to numpy/rasterio

**Cache folder structure to create manually :**
```
backend/cache/
  sentinel/
    parcels/          ← the 23 EZZAYRA polygons (for training)
    demo_sfax/        ← pre-computed demo zone (CRITICAL for demo < 30s)
```

**Sentinel risk :** GEE has quota limits. If downloading the 23 parcels takes too long, prioritize **the Sfax demo zone first**, parcels second.

---

#### P3 — Frontend Base

**What you do manually :**
- Install Leaflet + Leaflet.draw in the existing Next.js project
- Configure dynamic import (Leaflet is not SSR-compatible)
- Wire the API call to P2's mock to validate the full flow immediately

**Hour 2 deliverable :** Polygon drawable on the map, API call triggered on click, mock response displayed

---

### HOUR 2–4 : Stage 1 Training — Segmentation (P1)

#### Approach Decision — Segmentation

> **Fundamental problem :** 23 parcels = roughly 23 binary masks. This is insufficient to train a U-Net from scratch, even with aggressive augmentation.

**Recommended approach : Maximum Transfer Learning**

| Rank | Approach | Why |
|---|---|---|
| ✅ 1 | **U-Net + ResNet-34 pre-trained on ImageNet via `segmentation_models_pytorch`** | ImageNet backbone massively reduces data requirements. ResNet-34 fits in 4GB VRAM. |
| 🟡 2 | **U-Net + MobileNetV2** | Lighter, if VRAM becomes an issue |
| ❌ 3 | **U-Net from scratch** | Impossible with 23 examples |
| ❌ 4 | **SegFormer / transformers** | Too heavy for GTX 1650 |

**Recommended loss :**
- Combined BCE + Dice Loss (50/50)
- Reason : BCE alone converges poorly on small objects. Dice alone is unstable early in training. The combination is the industry standard for agricultural segmentation.
- Alternative if convergence is difficult : Focal Loss + Dice (Focal penalizes false negatives more heavily)

**Data strategy to compensate for 23 parcels :**

What you do manually to increase data volume :
- Slice each parcel into 256×256 pixel sub-patches (a 94 ha parcel yields several dozen patches)
- Count how many "positive" patches (containing olive trees) vs "negative" patches you get

**Augmentations to enable** (via `albumentations`) :
- Horizontal / vertical flips
- 90° / 180° / 270° rotations
- Slight brightness/contrast variation (simulates different seasons)
- **Do not** use strong geometric distortion — olive trees have characteristic shapes that should be preserved

**Spatial split — critical manual operation :**

You have 23 parcels spread across several areas. You must do this split **by hand** while looking at a map :
- Identify which parcels are geographically close (same village, same grove area)
- Place all parcels from the same area into the same split
- Target : 16 train / 4 val / 3 test
- **Golden rule :** Two neighboring parcels can never be in two different splits. Violation = artificially inflated score, and the jury will detect it.

**Training parameters for GTX 1650 (4GB VRAM) :**

| Parameter | Value | Reason |
|---|---|---|
| batch_size | 8 | Maximum viable on 4GB |
| epochs | 30–40 | ~1h30–2h on 1650 |
| learning rate | 1e-4 | Standard Adam for fine-tuning |
| optimizer | AdamW | Better regularization than vanilla Adam |
| scheduler | CosineAnnealingLR | Avoids plateaus late in training |

**Mandatory post-processing after inference :**
1. Apply sigmoid, threshold at 0.5
2. Morphological opening (3×3 kernel) to remove pixel noise
3. Filter contours smaller than 0.1 ha — too small to be real olive groves
4. Polygonize the binary mask using `rasterio.features.shapes()`

**Target metric :** IoU ≥ 0.65 on the test set

**If IoU < 0.55 after 20 epochs → trigger Plan B immediately (see end of document)**

---

### HOUR 4–6 : Stage 2 Training — Classification (P1) + Live API (P2)

#### Approach Decision — Classification

> **Context :** The EZZAYRA parcels have system labels. But with only 23 examples, you are not training a neural network — you are training a classifier on handcrafted features.

**Recommended approach : XGBoost on spectral + texture features**

| Rank | Approach | Why |
|---|---|---|
| ✅ 1 | **Multi-class XGBoost** | Optimal for small tabular datasets, robust to class imbalance, fast |
| 🟡 2 | **Random Forest** | Easier to debug, slightly lower performance |
| 🟡 3 | **LightGBM** | As good as XGBoost, slightly faster |
| ❌ 4 | **MLP / neural network** | Too little data for a network |

#### Features to Extract — What the pipeline computes automatically

**On each polygon detected by Stage 1 :**

Spectral indices (computed from Sentinel-2 bands) :
- Mean, max, min NDVI over May–June → overall vegetative vigor
- NDVI in January (winter) → olive trees = evergreen, NDVI stays > 0.2 even in winter
- **NDVI amplitude** (annual max - min) → key differentiator : extensive has high seasonal amplitude, hyper-intensive under irrigation stays stable year-round
- NDWI (water index) → irrigation detectable, strongly correlated with intensive/hyper-intensive systems
- NDRE (red-edge index) → vegetative stress, differentiates canopy densities

GLCM texture features (computed on B8 / NIR band) :
- Contrast → regular hyper-intensive hedgerows = low contrast
- Homogeneity → row plantations = high homogeneity
- Energy → geometric regularity, distinguishes intensive row plantings from irregular extensive groves
- **Agronomic explanation :** A hyper-intensive hedge system with rows spaced every 4m will show very periodic texture visible at 10m resolution. A traditional extensive grove with irregular trees will show chaotic texture.

Geometric features :
- Area in hectares
- Polygon compactness (perimeter² / area)

**Managing class imbalance — manual operation :**

Before training, count the distribution in your labels file :
- If any class has ≤ 3 examples → apply SMOTE (synthetic oversampling)
- Always pass `scale_pos_weight` to XGBoost, calculated as `n_majority / n_minority`

**Mandatory spatial validation :**
- Use `GroupKFold` with governorates as groups
- The jury will explicitly check that you did not use random validation

**Target metric :** F1 macro ≥ 0.70 across all 3 classes

**3×3 Confusion matrix :** Must be displayed in the interface — the jury explicitly requires it

---

#### P2 — Live API (while P1 trains)

**What you do manually :**
- Write the routing logic : if polygon matches the cached Sfax zone → response < 2s. Otherwise → full pipeline.
- Implement the in-memory job system (simple Python dict, no Redis needed)
- Test the `/api/cartographier` endpoint with Postman or curl using a real Sfax polygon

**Job architecture :**
- `POST /api/cartographier` → creates a job, returns `job_id` immediately
- `GET /api/job/{job_id}` → frontend polls every 2s
- `GET /api/export/{job_id}` → returns full GeoJSON for download

**Reason for async architecture :** The pipeline can take 20–30s under real conditions. A synchronous call would cause a browser timeout. Polling allows displaying a progress bar to the jury while they wait.

---

### HOUR 6–8 : Integration & Polish

#### P1 + P2 — Model Integration into the API

**What you do manually :**
- Save U-Net model weights (`.pth` file) into `backend/models/`
- Save the XGBoost classifier (`.pkl` file via joblib) into `backend/models/`
- Test the end-to-end pipeline on a Sfax test polygon not seen during training
- Validate that output GeoJSON polygons are valid (open in QGIS if available)

#### P3 — Frontend Polish

**What you do manually :**
- Verify that olive grove colors are clearly distinguishable on satellite background :
  - 🟢 light green `#22c55e` = extensive
  - 🟡 yellow `#eab308` = intensive
  - 🔴 red `#ef4444` = hyper-intensive
- Implement polygon size blocking if area > 100 km² (using turf.js `turf.area()`)
- Add a visible progress bar or spinner during processing (jury will wait 20–30s)
- Verify that the "Download GeoJSON" button generates a valid file

---

### HOUR 8–9 : Demo Cache & Rehearsal

**What you do manually :**
- Run the full pipeline **once** on the chosen Sfax zone and save the cache
- Run a complete rehearsal of the jury scenario :
  1. Draw the Sfax polygon
  2. Click "Analyze"
  3. Verify olive groves appear colored in < 5s (from cache)
  4. Verify the summary table
  5. Download the GeoJSON and verify its content
- Identify and fix any display bugs

**Final hour — buffer and corrections**

---

## 📦 What You Provide Manually

This section lists **all human operations** required, grouped by nature.

### Data to prepare by hand

| Operation | Who | When |
|---|---|---|
| Join the labels file to the 23 EZZAYRA parcels by ID | P1 | Hour 1 |
| Convert coordinates `{lat,lng}` → GeoJSON `[lng,lat]` | P1 | Hour 1 |
| Count the distribution of the 3 classes (E/I/HI) | P1 | Hour 1 |
| Visually inspect parcels in GEE to detect cloud cover | P1 | Hour 1–2 |
| Do the spatial train/val/test split manually on a map | P1 | Hour 2 |
| Choose and record the exact coordinates of the Sfax demo zone | P2 | Hour 1 |

### Accounts & Access

| Resource | Status | Required action |
|---|---|---|
| Google Earth Engine | ✅ Active | Create a dedicated hackathon project |
| OpenStreetMap Overpass | No registration needed | Ready to use |
| SoilGrids 250m | No registration needed | Optional, only if time allows |

### Decisions that must be made by a human

| Decision | Criterion | When |
|---|---|---|
| Which exact Sfax zone for the demo? | Choose an area with known olive grove concentration (El Amra, Agareb, Mahres) | Hour 1 |
| Merge intensive + hyper-intensive if a class has < 3 examples? | Depends on the actual label distribution | Hour 1 after inspection |
| Which NDVI threshold for the segmentation fallback? | Test 0.30 vs 0.35 vs 0.40 on a known parcel | Hour 3 if Plan B is triggered |

---

## 🗂️ Project File Structure

```
/
├── frontend/                     # Existing Next.js
│   ├── app/
│   │   └── page.tsx
│   └── components/
│       ├── MapView.tsx           # Leaflet + Leaflet.draw (dynamic import)
│       ├── StatsTable.tsx        # Summary table + confusion matrix
│       └── LayerControls.tsx     # Map background toggle
│
├── backend/                      # FastAPI
│   ├── main.py                   # Endpoints + job manager
│   ├── pipeline/
│   │   ├── sentinel.py           # GEE download + cache logic
│   │   ├── segmentation.py       # U-Net loading + inference
│   │   ├── features.py           # NDVI, NDWI, GLCM computation
│   │   ├── classification.py     # XGBoost loading + inference
│   │   └── geojson_utils.py      # Polygonization, area calculation, export
│   ├── models/
│   │   ├── unet_resnet34.pth     # Segmentation weights (you generate this)
│   │   └── xgb_classifier.pkl   # Classification weights (you generate this)
│   └── cache/
│       ├── sentinel/
│       │   ├── parcels/          # Bands for the 23 EZZAYRA parcels
│       │   └── demo_sfax/        # Pre-computed demo zone (CRITICAL)
│       └── results/
│           └── {job_id}.json     # Cached job results
│
└── docker-compose.yml
```

---

## 🔌 API Contract — Single Source of Truth

### `POST /api/cartographier`

Expected input :
```
perimeter_polygon : GeoJSON Polygon
date              : string (YYYY-MM-DD)
```

Expected output :
```
job_id  : string UUID
status  : "processing"
```

### `GET /api/job/{job_id}`

Output when complete :
```
status        : "done"
olive_groves  : list of polygons with system, confidence, surface_ha
stats         : total, total_surface_ha, breakdown E/I/HI
```

### `GET /api/export/{job_id}`

Returns a downloadable `.geojson` file with all annotated polygons.

### `GET /health`

Returns 200 OK — for the jury who will want to confirm the API is alive.

---

## ⚠️ Critical Pitfalls — From an Agronomist's Perspective

| Field pitfall | What it means concretely | Solution |
|---|---|---|
| **Spatial data leakage** | Two parcels 500m apart in both train AND test → model memorizes local soil, not olive trees | Split by entire geographic zone, never randomly |
| **Confusion between I and HI in peak season** | In May–June, intensive and hyper-intensive have similar NDVI (0.55–0.70). Spectrally indistinguishable from a single image. | Use **annual NDVI amplitude** and GLCM texture — the only signature that differentiates them |
| **Extensive = majority of data** | Tunisia has 65M olive trees, 80% in traditional dry extensive systems. Your dataset likely reflects this. | Verify distribution at hour 1. Apply SMOTE or `scale_pos_weight` in XGBoost. |
| **Winter imagery is unusable** | In December–January, olive trees are spectrally similar to maquis, carob trees, and cacti. Similar NDVI values. | Use exclusively May–June for both training and inference. |
| **Small parcels along roadsides** | Many Tunisian olive groves under 0.5 ha are bordered by roads or annual crops. The U-Net confuses the edges. | Post-processing : filter any polygon < 0.1 ha. |
| **Demo too slow** | The jury loses patience after 30s. A slow demo is a failed demo even if the model is good. | Sfax cache is mandatory. Test cache latency **before** the demo. |

---

## 📊 Jury Criteria — Translated Into Concrete Actions

| Official criterion | What the jury is actually checking | Your preparation |
|---|---|---|
| IoU ≥ 0.65 on segmentation | Do your detected polygons overlap the real olive groves? | Display IoU in the interface during the demo |
| F1 macro ≥ 0.70 on classification | Are all 3 classes correctly discriminated, including minority classes? | Display the 3×3 confusion matrix in the interface |
| Functional live demo | The app does not crash, E/I/HI colors appear correctly | Full rehearsal at hour 8 |
| Confusion matrix displayed | The jury wants to see and comment on it | Dedicated widget in StatsTable |
| Spatial validation applied | "Not just random" = the jury tests whether you understand the problem | Document your split in the demo (show train/test governorates) |
| Latency < 30s on 50 km² | Measured live | Cache = < 5s guaranteed |

---

## 🚨 Plan B — Trigger Without Hesitation

### If IoU < 0.55 after 20 training epochs (decision at hour 4)

**Plan B Segmentation — Supervised NDVI Threshold :**
- You have the EZZAYRA polygons as ground truth
- On the Sfax demo zone, compute NDVI over May–June via GEE
- Apply an NDVI threshold (calibrate on your parcels : test 0.30, 0.35, 0.40)
- Apply identical morphological post-processing
- **This is not cheating** — this is classical remote sensing. The jury respects honesty about data limitations.

### If class distribution is too imbalanced (< 3 examples per class)

**Plan B Classification — 2 classes instead of 3 :**
- Merge intensive + hyper-intensive into a single "irrigated" class
- The problem becomes binary : dry extensive vs irrigated
- Much more robust with limited data
- Binary F1 ≥ 0.70 is achievable
- **Announce this to the jury with the agronomic explanation** : "The I/HI boundary requires a monthly time series that Sentinel-2 cannot resolve at our data volume"

### If the full pipeline is too slow for the demo (> 45s)

**Plan B Demo — Extended cache mode :**
- Pre-compute 3 different Sfax zones and store them
- Display a list of predefined zones in the interface alongside the free-draw tool
- The jury can pick a pre-computed zone for an instant demo, then attempt a free zone as a bonus

---

## 🔧 Tools & Libraries — Justified Decisions

### Python Backend

| Tool | Usage | Alternative if issues arise |
|---|---|---|
| `segmentation_models_pytorch` | U-Net + pre-trained backbone | `torchvision` (fewer available models) |
| `albumentations` | Geospatial image augmentation | `torchvision.transforms` (less powerful) |
| `rasterio` | Raster read/write, polygonization | `gdal` direct (more complex) |
| `geemap` | Python interface for GEE | `earthengine-api` direct (more verbose) |
| `xgboost` | Multi-class classification | `sklearn.ensemble.RandomForestClassifier` |
| `scikit-image` | GLCM texture computation | `mahotas` (less documented) |
| `shapely` | Geometric operations on polygons | `fiona` |
| `joblib` | Save/load XGBoost model | `pickle` (less reliable) |

### JavaScript Frontend

| Tool | Usage | Alternative |
|---|---|---|
| `leaflet` + `react-leaflet` | Interactive map | Mapbox (paid) |
| `leaflet-draw` | User polygon drawing | No equally simple free alternative |
| `@turf/turf` | Polygon area calculation (block > 100 km²) | Manual haversine calculation |

---

> **Final note from the PM :**
> Your real constraint is not technical — it is data volume. 23 parcels is what you have to work with, and it is enough to deliver a convincing demo if you are honest about limitations and solid on execution. Do not waste time searching for additional data. Focus on : (1) a flawless demo cache, (2) a clean confusion matrix, (3) an interface that tells the story. The jury rewards methodological rigor as much as raw metrics.
