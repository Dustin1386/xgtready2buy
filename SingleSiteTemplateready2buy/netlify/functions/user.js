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

  const { email, firstName, lastName, phone, dob } = JSON.parse(
    event.body || "{}",
  );
  if (!email)
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "email required" }),
    };

  try {
    // Try to find existing user first
    const findRes = await fetch(
      `${BASE_URL}/users/find?ApiKey=${API_KEY}&StoreID=${STORE_ID}&Email=${encodeURIComponent(email)}`,
    );
    const findData = await findRes.json();
    console.log("[user] find result:", JSON.stringify(findData));

    if (findData.users && findData.users.length > 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          userId: findData.users[findData.users.length - 1].UserId,
        }),
      };
    }

    // Create new prospect
    const p = new URLSearchParams({
      ApiKey: API_KEY,
      StoreId: STORE_ID,
      FirstName: firstName || "",
      LastName: lastName || "",
      Email: email,
      SendEmail: "true",
      PromotionalSmsOptIn: "true",
      NonPromotionalSmsOptIn: "true",
      ProspectTypeId: 54711, // Default to "Lead" prospect type
      ReferralTypeId: 179966, // Default to "Website" referral type
    });
    if (phone) p.set("Phone", phone);
    // ClubReady expects MM/DD/YYYY — convert from YYYY-MM-DD if needed
    if (dob) {
      const isoMatch = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      p.set("DateOfBirth", isoMatch ? `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1]}` : dob);
    }

    console.log("[user] creating prospect with params:", p.toString());
    const pRes = await fetch(`${BASE_URL}/users/prospect?${p}`, {
      method: "POST",
    });
    const pData = await pRes.json();
    console.log("[user] prospect response:", JSON.stringify(pData));

    // ClubReady uses inconsistent casing — check both
    const success = pData.Success ?? pData.success;
    const userId  = pData.UserId  ?? pData.userId;
    const message = pData.Message ?? pData.message ?? pData.error ?? JSON.stringify(pData);

    if (!success || !userId) {
      if (message && /already exist/i.test(message)) {
        const retryRes = await fetch(
          `${BASE_URL}/users/find?ApiKey=${API_KEY}&StoreID=${STORE_ID}&Email=${encodeURIComponent(email)}`,
        );
        const retryData = await retryRes.json();
        if (retryData.users && retryData.users.length > 0) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              userId: retryData.users[retryData.users.length - 1].UserId,
            }),
          };
        }
      }
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: message || "Could not create account",
          clubreadyResponse: pData,
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ userId: pData.UserId }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
