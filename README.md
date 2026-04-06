# FLIGHT TARGET – דאשבורד משלחות וטיסות מיוחדות

דאשבורד אינטראקטיבי המתעקב אחר טיסות מיוחדות של משלחות ישראליות, אירועים ספורטיביים, טיסות קהילה וטיסות סימולציה.

🌐 **[צפה בדאשבורד בחיים](https://flight-target.vercel.app)**

## 📋 תכונות עיקריות

### 🗺️ מפה אינטראקטיבית
- מפת Leaflet.js המציגה קווי טיסה מ-LLBG (שדה התעופה בן גוריון) לעולם
- קווי טיסה אנימטיביים כחולים (יוצאים) ואדומים (נכנסים)
- סימני מזג אוויר בטמפרטורה ברשתות היעד

### 📅 תצוגת קלנדר
- קלנדר אינטראקטיבי עם ניווט חודשי
- ימים עם טיסות מסומנים בכחול וזוהרים
- ימים בעבר עם אירועים מסומנים **באדום**
- לחץ על יום כדי לראות את כל הטיסות של אותו יום

### 🎯 קטגוריות טיסות
- ⚽ **ספורט**: כדורגל, כדורסל, ענפים אחרים
- ✡️ **קהילה ויהדות**: משלחות קהילתיות, משלחות חילוץ
- 💼 **עסקים וטכנולוגיה**: Israel Tech Week, כנסים בינלאומיים
- 🏛️ **דיפלומטיה וממשל**: טיסות VIP, משלחות דיפלומטיות
- 🎨 **תרבות ואומנות**: יורוביזיון, קונצרטים, אירועי תרבות
- 👥 **טיסות קהילה**:
  - 🎮 **VATIL**: תחרויות סימולציה טיסה
  - 🏥 **Doctor Simulator**: טיסות הדרכה בסימולטור בעולם

### 📡 RSS Feed Integration
- **Doctor Simulator World Tour**: אינטגרציה עם RSS feed של טיסות הדרכה בסימולטור
- רענון אוטומטי כל 3 דקות
- קואורדינטות מדויקות שנחזרות מה-RSS

### 🌡️ תכונות נוספות
- **מזג אוויר בזמן אמת**: METAR data מה-Open-Meteo API
- **תמונות דינמיות**: חיפוש תמונות רלוונטיות מ-Pexels API
- **עדכון מידע**: סימן של "חדש" לטיסות שנוצרו ב-24 השעות האחרונות
- **מצב כהה/בהיר**: תמה מתחלפת בהודעה לעדכון בזמן אמת
- **עצמאי RTL**: תמיכה מלאה בעברית (מימין לשמאל)
- **ספירת מבקרים**: מעקב דינמי על מספר מבקרים

## 🛠️ טכנולוגיה

### Frontend
- **HTML5 + CSS3**: עיצוב מגייס עם תמוכה RTL
- **Vanilla JavaScript**: ללא תלויות ספרייות כבדות
- **Leaflet.js**: מיפוי אינטראקטיבי
- **Open-Meteo API**: נתוני מזג אוויר בזמן אמת

### Backend & Infrastructure
- **Vite**: build tool מהיר
- **Vercel**: Deployment ו-CDN
- **GitHub**: Version control
- **RSS Parser**: קריאת feeds של Doctor Simulator

### APIs
- 🌍 **Open-Meteo**: נתוני מזג אוויר
- 📷 **Pexels**: חיפוש תמונות
- 📊 **CounterAPI**: ספירת מבקרים
- 📡 **Doctor Simulator RSS**: אינטגרציית טיסות הדרכה
- 🔗 **GitHub API**: מידע על deployment

## 📁 מבנה הפרוייקט

```
FLIGHT TARGET/
├── index.html          # HTML ראשי עם מבנה עמוד
├── main.js            # לוגיקה ראשית (טעינה, filtering, display)
├── style.css          # עיצוב וטמוטיקה (dark/light)
├── data.js            # נתוני טיסות ו-airports
├── logo.png           # לוגו אתר
├── logo1.png          # לוגו Doctor Simulator
├── logo2.jpg          # לוגו VATIL
└── README.md          # קובץ זה
```

## 🚀 התחלת שימוש

### קריאה מקומית
1. Clone את ה-repository
   ```bash
   git clone https://github.com/maor561/FLIGHT-TARGET.git
   ```

2. פתח `index.html` בדפדפן או שמש:
   ```bash
   npm install -g vite
   vite
   ```

3. פתח את `http://localhost:5173`

### פרסום ל-Vercel
כל push ל-`master` branch יפעיל deployment אוטומטי ל-Vercel.

## 📊 מקורות נתונים

### טיסות בסיסיות
- נתונים ייד ב-`data.js` עם 24+ טיסות בקטגוריות שונות
- עדכון אחרון: 2026-04-04

### Doctor Simulator Flights
- **Source**: RSS feed מ-[doctor-simulator-flights.vercel.app](https://doctor-simulator-flights.vercel.app/api/rss)
- **תדירות עדכון**: כל 3 דקות
- **טיסות נוכחיות**: 7 טיסות (Legs 1-7 של 47 legs totals)

### Airports
35+ נמלי תעופה בעולם עם:
- שם בעברית וקואורדינטות GPS
- עובדות ותיאור מעניינים
- קישורים בין-אתריים לטיסות

## 🎨 עיצוב וAPI

### צבעים
- **Dark Mode**: רקע כהה (#313d4d), accent כחול (#00d2ff)
- **Light Mode**: רקע בהיר (#f5f5f5), accent כחול בהיר (#0284c7)
- **Past Events**: אדום (#ff6b6b בdark, #ef4444 בlight)
- **Today**: זהב (#ffd700)

### נקודות סיום API
- `GET /api/rss` - Doctor Simulator flights (RSS 2.0)
- `GET /forecast` - Open-Meteo weather (JSON)
- `GET /search?query=` - Pexels image search (JSON)

## 🔧 פיצ'רים בהתפתחות

- [ ] הוסף More filtering options (airline, aircraft type)
- [ ] הוסף Flight notifications push
- [ ] הוסף Export calendar ל-iCal
- [ ] שיפור ביצועי מפה עבור 50+ טיסות

## 📝 פיתוח

### הוספת טיסה חדשה ל-data.js
```javascript
{
    id: "X001",
    category: "football",  // ס"ה: football, basketball, sports-other, jewish, rescue, diplomatic, business, culture, vatil, doctor-simulator
    title: "שם הטיסה",
    mission: "תיאור המשימה",
    background: "תיאור רקע",
    route: "XXXX -> YYYY",
    dest_icao: "YYYY",
    date: "2026-04-06",
    time: "14:30",
    airline: "אל על",
    aircraft: "Boeing 787-9",
    icon: "⚽",
    source: "מקור הנתונים",
    imageUrl: "url_to_image",
    createdAt: "2026-04-06T00:00:00Z",
    isNew: false
}
```

### הוספת airport חדש
```javascript
"XXXX": {
    name: "Airport Name",
    coords: [latitude, longitude],
    facts: ["עובדה 1", "עובדה 2"]
}
```

## 📜 License

Public project - צפה בחופשיות וגם שתוף!

## 🤝 Contributing

שיתוף פעולה משוקלל! נא לשלוח PR עם שיפורים, תיקונים או טיסות חדשות.

## 📧 Contact

יוצר: Claude Haiku 4.5
Repository: https://github.com/maor561/FLIGHT-TARGET
Live Site: https://flight-target.vercel.app

---

**עדכון אחרון**: אפריל 2026
**גרסה**: 1.1.0
