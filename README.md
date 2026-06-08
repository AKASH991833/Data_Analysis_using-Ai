# NexusAI Analytics 🚀

NexusAI Analytics is a sophisticated, AI-powered data analysis platform designed to transform raw datasets into actionable insights with professional-grade visualizations. Built with Next.js 15, Drizzle ORM, and Recharts, it offers a seamless experience for data profiling, cleaning, and exploration.

![NexusAI Analytics](https://img.shields.io/badge/NexusAI-Analytics-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)

## ✨ Key Features

- **🧠 Intelligent Data Profiling:** Automatically detects data types, semantic categories (Revenue, Location, Customer, etc.), and evaluates data quality.
- **🧹 Auto-Cleaning Engine:** One-click statistical imputation for missing values, whitespace normalization, and duplicate removal.
- **📈 Professional Visualizations:** Interactive Bar, Line, Area, Pie, and Scatter charts with Excel-style professional aesthetics.
- **💡 AI Insights Generator:** Automatically identifies trends, anomalies, and provides data-driven recommendations.
- **💬 Natural Language Queries:** Ask questions about your data in plain English and get instant answers with relevant charts.
- **📊 Dynamic Dashboards:** Create and save custom widgets to build comprehensive data stories.
- **📂 Multi-Format Support:** Seamlessly upload and analyze CSV and Excel files.

## 🛠️ Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion
- **Visualizations:** Recharts, Lucide React
- **Backend:** Next.js API Routes
- **Database:** MySQL with Drizzle ORM
- **Utilities:** Papaparse (CSV), XLSX (Excel), UUID

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
- MySQL Database

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AKASH991833/Data_Analysis_using-Ai.git
   cd Data_Analysis_using-Ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory and add your database credentials:
   ```env
   DB_HOST=your_host
   DB_PORT=3306
   DB_USER=your_user
   DB_PASSWORD=your_password
   DB_NAME=your_db_name
   ```

4. **Initialize the database:**
   ```bash
   npm run drizzle-kit push
   ```

5. **Run the development server:**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📁 Project Structure

- `src/app/api`: Serverless API routes for data processing and database operations.
- `src/components`: Reusable UI components including the advanced Excel-style charts.
- `src/lib/analytics-engine.ts`: The core logic for data profiling, cleaning, and insight generation.
- `src/db`: Database schema definitions and Drizzle configuration.

## 🌐 Deployment

To deploy this application live:

1. **Vercel (Recommended):**
   - Connect your GitHub repository to [Vercel](https://vercel.com).
   - Configure your environment variables in the Vercel dashboard.
   - Deploy!

2. **Database:**
   - Use a managed MySQL service like **Tidb Cloud**, **PlanetScale** or **Aiven** for a production-ready database.

## 📄 License

This project is licensed under the MIT License.

---
Built with ❤️ by [AKASH991833](https://github.com/AKASH991833)
