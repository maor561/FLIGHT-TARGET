# FLIGHT TARGET – דאשבורד משלחות וטיסות מיוחדות

דאשבורד אינטראקטיבי המתעקב אחר טיסות מיוחדות של משלחות ישראליות, אירועים ספורטיביים, טיסות קהילה וטיסות סימולציה.

🌐 **[צפה בדאשבורד בחיים](https://flight-target.vercel.app)**

## 📋 תכונות עיקריות

### 🗺️ מפה אינטראקטיבית
- מפת Leaflet.js המציגה קווי טיסה מ-LLBG (שדה התעופה בן גוריון) לעולם
- קווי טיסה אנימטיביים כחולים (יוצאים) ואדומים (נכנסים)
- סימני מזג אוויר בטמפרטורה ברשתות היעד
- Hover על כרטיס טיסה → הדגשת מסלול על המפה

### 📅 תצוגת קלנדר
- קלנדר אינטראקטיבי עם ניווט חודשי
- ימים עם טיסות מסומנים בכחול וזוהרים
- ימים בעבר עם אירועים מסומנים **באדום**
- לחץ על יום כדי לראות את כל הטיסות של אותו יום

### 🎯 קטגוריות טיסות
- ⚽ **ספורט**: כדורגל, כדורסל, ענפים אחרים
- ✡️ **קהילה ויהדות**: משלחות קהילתיות, משלחות חילוץ
- 💼 **עסקים וטכנולוגיה**: כנסים בינלאומיים ותערוכות
- 🏛️ **דיפלומטיה וממשל**: טיסות VIP, משלחות דיפלומטיות
- 🎨 **תרבות ואומנות**: אירועי תרבות בינלאומיים
- 👥 **טיסות קהילה**:
  - 🎮 **VATIL**: תחרויות סימולציה טיסה
  - 🏥 **Doctor Simulator**: טיסות הדרכה בסימולטור בעולם

### 🎙️ VATSIM ATC Integration
- הצגת בקרות פעילות בנתב"ג בזמן אמת דרך VATSIM API v3
- תמיכה בכל עמדות הבקרה: **CTR (LLLL), APP, TWR, GND, DEL, ATIS**
- Tooltip עם פרטים מלאים בהובר — כולל תדר, שם בקר ותוכן ATIS
- טולטיפ ATIS מציג את תוכן שידור ה-ATIS (text_atis) בשלמותו
- הטולטיפ ממוקם דינמית מתחת לסרגל הבקרה, בין המפה לתפריט הצד

### 📡 RSS Feed Integration
- **Doctor Simulator World Tour**: אינטגרציה עם RSS feed של טיסות הדרכה בסימולטור
- רענון אוטומטי כל 3 דקות
- תמיכה בקואורדינטות שליליות (חצי כדור מערבי/דרומי)

### 🌡️ תכונות נוספות
- **מזג אוויר בזמן אמת**: METAR data מ-LLBG
- **עדכון מידע**: סימן "חדש" לטיסות שנוצרו ב-24 השעות האחרונות
- **מצב כהה/בהיר**: החלפת תמה
- **תמיכה מלאה ב-RTL**: עברית מימין לשמאל
- **ספירת מבקרים**: מעקב דינמי

## 🛠️ טכנולוגיה

### Frontend
- **HTML5 + CSS3**: עיצוב עם תמיכה RTL מלאה
- **Vanilla JavaScript**: ללא תלויות ספרייות כבדות
- **Leaflet.js**: מיפוי אינטראקטיבי

### Infrastructure
- **Vercel**: Deployment ו-CDN (auto-deploy על כל push ל-master)
- **GitHub**: Version control

### APIs
- 🌍 **Open-Meteo**: נתוני מזג אוויר
- 🛫 **VATSIM API v3**: בקרות ATC בזמן אמת
- 📊 **CounterAPI**: ספירת מבקרים
- 📡 **Doctor Simulator RSS**: אינטגרציית טיסות הדרכה

## 📁 מבנה הפרוייקט

```
FLIGHT TARGET/
├── index.html          # HTML ראשי
├── main.js             # לוגיקה ראשית (טעינה, filtering, display, VATSIM)
├── style.css           # עיצוב ותמוטיקה (dark/light)
├── data.js             # נתוני טיסות בסיסיות ו-airports
├── logo.png            # לוגו אתר
├── logo1.png           # לוגו Doctor Simulator
├── logo2.jpg           # לוגו VATIL
└── README.md           # קובץ זה
```

## 📊 מקורות נתונים

### טיסות בסיסיות
- ~28 טיסות ב-`data.js` בקטגוריות: כדורגל, כדורסל, ענפים נוספים, דיפלומטיה, תרבות, קהילה ועסקים
- Doctor Simulator flights נטענים דינמית מ-RSS feed

### Airports
35+ נמלי תעופה בעולם עם קואורדינטות GPS ועובדות מעניינות.

## 🎨 עיצוב

### צבעים
- **Dark Mode**: רקע כהה (`#1f2937 / #2d3748`), accent כחול (`#00d2ff`)
- **Light Mode**: רקע בהיר (`#f0f2f5`), accent כחול (`#0284c7`)
- **Past Events**: אדום (`#ff6b6b`)
- **Today**: זהב (`#ffd700`)

## 🚀 הרצה מקומית

```bash
git clone https://github.com/maor561/FLIGHT-TARGET.git
cd FLIGHT-TARGET
python -m http.server 8080
# פתח http://localhost:8080
```

כל push ל-`master` מפעיל deployment אוטומטי ל-Vercel.

## 📝 הוספת טיסה חדשה ל-data.js

```javascript
{
    id: "X001",
    category: "football",  // football | basketball | sports-other | jewish | rescue | diplomatic | business | culture | vatil | doctor-simulator
    title: "שם הטיסה",
    mission: "תיאור המשימה",
    background: "תיאור רקע",
    route: "LLBG -> YYYY",
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

## 📜 License

Public project — צפה בחופשיות ושתף!

---

**גרסה**: v48  
**עדכון אחרון**: אפריל 2026  
**Repository**: https://github.com/maor561/FLIGHT-TARGET  
**Live Site**: https://flight-target.vercel.app
