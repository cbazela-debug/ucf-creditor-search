// api/health.js
module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ status: "ok", message: "UCF Search API running on Vercel" });
};
