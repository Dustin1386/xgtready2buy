const API_KEY   = process.env.CLUBREADY_API_KEY;
const STORE_ID  = process.env.CLUBREADY_STORE_ID;
const PACKAGE_ID = process.env.CLUBREADY_PACKAGE_ID;
const BASE_URL  = 'https://clubready.com/api/current';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { userId, promoCode } = JSON.parse(event.body || '{}');
  if (!userId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'userId required' }) };
  }

  try {
    // Step 1: Get a preview IncompleteAgreementToken — used only to fetch contract text.
    // This token is intentionally discarded; purchase.js calls agreement/add fresh at submit time.
    const agreeParams = new URLSearchParams({
      ApiKey:    API_KEY,
      MemberId:  userId,
      StoreId:   STORE_ID,
      PackageId: PACKAGE_ID,
    });
    if (promoCode) agreeParams.set('PromoCode', promoCode);

    const agreeRes  = await fetch(`${BASE_URL}/sales/agreement/add?${agreeParams}`, { method: 'POST' });
    const agreeData = await agreeRes.json();

    if (!agreeData.success || !agreeData.incompleteAgreementToken) {
      console.log('[get-agreement-preview] agreement/add failed:', JSON.stringify(agreeData));
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: agreeData.message || 'Could not fetch agreement preview' }),
      };
    }

    // Step 2: Fetch the contract HTML using that token.
    // Per ClubReady docs: GET /sales/agreement/contract?ApiKey=&StoreId=&IncompleteAgreementToken=
    // Response: { contractHtml, incompleteAgreementToken, success, message }
    const contractParams = new URLSearchParams({
      ApiKey:                   API_KEY,
      StoreId:                  STORE_ID,
      IncompleteAgreementToken: agreeData.incompleteAgreementToken,
    });

    const contractRes  = await fetch(`${BASE_URL}/sales/agreement/contract?${contractParams}`, {
      headers: { Accept: 'application/json' },
    });
    const contractData = await contractRes.json();

    if (!contractData.success || !contractData.contractHtml) {
      console.log('[get-agreement-preview] contract fetch failed:', JSON.stringify(contractData));
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: contractData.message || 'Contract text not available' }),
      };
    }

    let html = contractData.contractHtml;
    // Remove the agreetable (contains a broken base64 image and stray artifacts)
    html = html.replace(/<table[^>]*id="agreetable"[\s\S]*?<\/table>/gi, '');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ contractHtml: html }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
