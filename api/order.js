export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      name,
      phone,
      address,
      product,
      note
    } = req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({
        error: "Thiếu họ tên, số điện thoại hoặc địa chỉ"
      });
    }

    const apiKey = process.env.PANCAKE_API_KEY;
    const shopId = process.env.PANCAKE_SHOP_ID;

    if (!apiKey || !shopId) {
      return res.status(500).json({
        error: "Chưa cấu hình Pancake API Key hoặc Shop ID"
      });
    }

    const response = await fetch(
      `https://pos.pages.fm/api/v1/shops/${shopId}/orders?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customer: {
            name: name,
            phone_number: phone
          },
          shipping_address: {
            name: name,
            phone_number: phone,
            address: address
          },
          note: note || "",
          items: [
            {
              name: product || "Ốt Gió Ngậm Đạm",
              quantity: 1
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Pancake từ chối tạo đơn",
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      order: data
    });

  } catch (error) {
    return res.status(500).json({
      error: "Lỗi máy chủ",
      message: error.message
    });
  }
}
