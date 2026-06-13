const API_KEY = process.env.CLUBREADY_API_KEY;
const STORE_ID = process.env.CLUBREADY_STORE_ID;
const PACKAGE_ID = process.env.CLUBREADY_PACKAGE_ID;
const BASE_URL = "https://clubready.com/api/current";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const {
    userId,
    profileToken,
    scheduleId,
    bookingDate,
    promoApplied,
    promoCode,
    amount,
  } = JSON.parse(event.body || "{}");

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "userId required" }),
    };
  }

  try {
    // Step 1: Import ProfileToken if we have one
    if (profileToken) {
      const importParams = new URLSearchParams({
        ApiKey: API_KEY,
        ProfileToken: profileToken,
        NewOwnerId: userId,
      });
      const importRes = await fetch(
        `${BASE_URL}/sales/paymentprofile/import?${importParams}`,
        { method: "POST" },
      );
      const importData = await importRes.json();
      if (!importData.Success) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: importData.Message || "Could not save payment method",
          }),
        };
      }
    }

    // Step 2: Set up agreement
    const agreeParams = new URLSearchParams({
      ApiKey: API_KEY,
      MemberId: userId,
      StoreId: STORE_ID,
      PackageId: PACKAGE_ID,
    });
    if (promoApplied && promoCode) {
      agreeParams.set("PromoCode", promoCode);
    }

    const agreeRes = await fetch(
      `${BASE_URL}/sales/agreement/add?${agreeParams}`,
      { method: "POST" },
    );
    const agreeData = await agreeRes.json();

    if (!agreeData.success || !agreeData.incompleteAgreementToken) {
      console.log("[purchase] agreement failed:", JSON.stringify(agreeData));
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: agreeData.message || "Could not set up agreement",
          detail: agreeData,
        }),
      };
    }

    // Step 3: Complete sale
    // If promo applied, ClubReady handles the discount via PromoCode on agreement/add
    // We still need to charge the full amount — ClubReady will zero it out via the promo
    const paymentAmount = amount || 25;
    const saleBody = new URLSearchParams({
      ApiKey: API_KEY,
      MemberId: userId,
      StoreId: STORE_ID,
      IncompleteAgreementToken: agreeData.incompleteAgreementToken,
      PaymentAmount: paymentAmount,
    });

    // Always include PaymentMethods — ClubReady zeros out if promo was valid
    saleBody.append(
      "PaymentMethods",
      JSON.stringify([
        {
          PaymentAmount: paymentAmount,
          UsePreferred: true,
        },
      ]),
    );

    const saleRes = await fetch(`${BASE_URL}/sales/agreement/sale`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: saleBody.toString(),
    });
    const saleData = await saleRes.json();

    if (!saleData.success) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: saleData.message || "Payment declined" }),
      };
    }

    // Step 4: Book the class (optional — skipped when no scheduleId)
    let bookingId = null;
    if (scheduleId && bookingDate) {
      const bookParams = new URLSearchParams({
        ApiKey: API_KEY,
        StoreID: STORE_ID,
        UserId: userId,
        ScheduleId: scheduleId,
        Date: bookingDate,
      });
      const bookRes = await fetch(
        `${BASE_URL}/scheduling/class-booking?${bookParams}`,
        { method: "POST" },
      );
      const bookData = await bookRes.json();
      bookingId = bookData.BookingId || null;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, bookingId }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
