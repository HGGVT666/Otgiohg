export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed",
    });
  }

  try {
    const {
      name,
      phone,
      address,
      product,
      note,
    } = req.body || {};

    // ==============================
    // 1. KIỂM TRA DỮ LIỆU
    // ==============================

    if (!name || !phone || !address || !product) {
      return res.status(400).json({
        success: false,
        error: "Thiếu thông tin đặt hàng",
        received: {
          name,
          phone,
          address,
          product,
          note,
        },
      });
    }

    // ==============================
    // 2. PANCAKE CONFIG
    // ==============================

    const apiKey = process.env.PANCAKE_API_KEY;
    const shopId = process.env.PANCAKE_SHOP_ID;

    if (!apiKey || !shopId) {
      return res.status(500).json({
        success: false,
        error: "Thiếu PANCAKE_API_KEY hoặc PANCAKE_SHOP_ID",
      });
    }

    // ==============================
    // 3. CHUẨN HÓA SĐT
    // ==============================

    let cleanPhone = String(phone)
      .replace(/\s+/g, "")
      .replace(/[().-]/g, "");

    if (cleanPhone.startsWith("+84")) {
      cleanPhone = "0" + cleanPhone.substring(3);
    }

    // ==============================
    // 4. GIÁ SẢN PHẨM
    // ==============================

    let price = 189000;
    let productName = product;

    if (product.includes("Combo 2")) {
      price = 349000;
    }

    if (product.includes("Combo 3")) {
      price = 489000;
    }

    // ==============================
    // 5. URL PANCAKE
    // ==============================

    const url =
      `https://pos.pages.fm/api/v1/shops/${shopId}/orders` +
      `?api_key=${encodeURIComponent(apiKey)}`;

    // ==============================
    // 6. BODY GỬI PANCAKE
    // ==============================

    const orderBody = {
      customer: {
        name: name,
        phone_number: cleanPhone,
      },

      shipping_address: {
        name: name,
        phone_number: cleanPhone,
        address: address,
      },

      note: note || "",

      items: [
        {
          name: productName,
          quantity: 1,
          price: price,
        },
      ],
    };

    console.log("========== PANCAKE REQUEST ==========");
    console.log(JSON.stringify(orderBody, null, 2));
    console.log("SHOP ID:", shopId);

    // ==============================
    // 7. GỌI PANCAKE
    // ==============================

    const response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },

      body: JSON.stringify(orderBody),
    });

    // ==============================
    // 8. ĐỌC RESPONSE
    // ==============================

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        raw: text,
      };
    }

    console.log("========== PANCAKE RESPONSE ==========");
    console.log("STATUS:", response.status);
    console.log(JSON.stringify(data, null, 2));

    // ==============================
    // 9. PANCAKE TỪ CHỐI
    // ==============================

    if (!response.ok) {
      return res.status(400).json({
        success: false,

        error: "Pancake từ chối tạo đơn",

        pancake_status: response.status,

        pancake_response: data,

        sent_data: {
          name,
          phone: cleanPhone,
          address,
          product,
          price,
          note,
        },
      });
    }

    // ==============================
    // 10. THÀNH CÔNG
    // ==============================

    return res.status(200).json({
      success: true,

      message: "Đã tạo đơn Pancake thành công",

      order: data,
    });

  } catch (error) {

    console.error("========== SERVER ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,

      error: "Lỗi máy chủ",

      message: error?.message || "Unknown error",
    });
  }
}
