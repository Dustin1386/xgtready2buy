const API_KEY = process.env.CLUBREADY_API_KEY;
const STORE_ID = process.env.CLUBREADY_STORE_ID;
const BASE_URL = "https://clubready.com/api/current";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const { date } = event.queryStringParameters || {};
  if (!date)
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "date required" }),
    };

  try {
    console.log(
      "[schedule] API_KEY present:",
      !!API_KEY,
      "| STORE_ID:",
      STORE_ID,
      "| date:",
      date,
    );
    const url = `${BASE_URL}/scheduling/class-schedule?ApiKey=${API_KEY}&StoreId=${STORE_ID}&FromDate=${date}&ToDate=${date}`;
    console.log("[schedule] fetching:", url);
    const res = await fetch(url);
    console.log("[schedule] status:", res.status);
    const data = await res.json();
    console.log(
      "[schedule] returned",
      Array.isArray(data) ? data.length : "non-array",
      "items",
    );
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
