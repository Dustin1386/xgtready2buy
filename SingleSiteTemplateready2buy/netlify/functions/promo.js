const STORE_ID = process.env.CLUBREADY_STORE_ID;
const PACKAGE_DISCOUNT_ID = process.env.CLUBREADY_PACKAGE_DISCOUNT_ID;
const BASE_URL = "https://app.clubready.com/JoinUs/PackageSummary";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (!STORE_ID || !PACKAGE_DISCOUNT_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Missing ClubReady store or package discount configuration" }),
    };
  }

  const { promoCode } = JSON.parse(event.body || "{}");
  if (!promoCode) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "promoCode required" }),
    };
  }

  try {
    const url = new URL(BASE_URL);
    url.searchParams.set("storeId", STORE_ID);
    url.searchParams.set("packageDiscountId", PACKAGE_DISCOUNT_ID);
    url.searchParams.set("promoCode", promoCode);
    url.searchParams.set("r", Date.now().toString());

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Node.js)",
        "Referer": "https://app.clubready.com/",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "ClubReady promo validation failed", detail: text.slice(0, 1000) }),
      };
    }

    const html = await res.text();
    const getAmount = (label) => {
      const re = new RegExp(`<td[^>]*>\\s*${label}:\\s*</td>\\s*<td[^>]*class="text-right"[^>]*>\\s*\\$([0-9,.]+)`, "i");
      const match = html.match(re);
      return match ? parseFloat(match[1].replace(/,/g, "")) : null;
    };

    const promoUsedMatch = html.match(/<span[^>]*id="promotion-used"[^>]*>[\s\S]*?<em>([^<]+)<\/em>/i);
    const isValid = Boolean(promoUsedMatch);

    if (!isValid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid promo code" }),
      };
    }

    const packagePrice = getAmount("Package Price");
    const dueToday = getAmount("Due Today") ?? getAmount("Before Tax");
    const beforeTax = getAmount("Before Tax");
    const tax = getAmount("Tax");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        promoCode: promoUsedMatch ? promoUsedMatch[1] : promoCode,
        packagePrice,
        beforeTax,
        tax,
        dueToday,
        html,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
