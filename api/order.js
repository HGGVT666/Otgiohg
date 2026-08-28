export default async function handler(req, res) {
  // =========================================
  // 1. CHỈ NHẬN POST
  // =========================================

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed",
    });
  }

  try {
    // =========================================
    // 2. NHẬN DỮ LIỆU TỪ WEBSITE
    // =========================================

    const {
      name,
      phone,
      address,
      product,
      note,
      source,
      created_at,
    } = req.body || {};

    // =========================================
    // 3. KIỂM TRA THÔNG TIN KHÁCH
    // =========================================

    if (!name || !phone || !address || !product) {
      return res.status(400).json({
        success: false,
        error: "Thiếu thông tin đặt hàng",
      });
    }

    // =========================================
    // 4. LẤY CẤU HÌNH PANCAKE TỪ VERCEL
    // =========================================

    const apiKey = process.env.PANCAKE_API_KEY;
    const shopId = process.env.PANCAKE_SHOP_ID;

    if (!apiKey || !shopId) {
      console.error("THIEU PANCAKE ENV");

      return res.status(500).json({
        success: false,
        error: "Chưa cấu hình PANCAKE_API_KEY hoặc PANCAKE_SHOP_ID trên Vercel",
      });
    }

    // =========================================
    // 5. XÁC ĐỊNH SẢN PHẨM
    // =========================================

    let productInfo;

    switch (product) {

      case "1 Hộp 350ml - 189.000đ":
        productInfo = {
          name: "Ớt Gió Ngâm Dấm Nho Quế 350ml",
          sku: "OTG350",
          quantity: 1,
          price: 189000,
        };
        break;

      case "Combo 2 hộp - 349.000đ":
        productInfo = {
          name: "Combo 2 hộp Ớt Gió Ngâm Dấm Nho Quế 350ml",
          sku: "OTG350-CB2",
          quantity: 2,
          price: 349000,
        };
        break;

      case "Combo 3 hộp - 489.000đ":
        productInfo = {
          name: "Combo 3 hộp Ớt Gió Ngâm Dấm Nho Quế 350ml",
          sku: "OTG350-CB3",
          quantity: 3,
          price: 489000,
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          error: "Sản phẩm không hợp lệ",
        });
    }

    // =========================================
    // 6. CHUẨN HÓA SỐ ĐIỆN THOẠI
    // =========================================

    const cleanPhone = String(phone)
      .replace(/\s+/g, "")
      .replace(/[^\d+]/g, "");

    // =========================================
    // 7. TẠO URL API PANCAKE
    // =========================================

    const url =
      `https://pos.pages.fm/api/v1/shops/${shopId}/orders` +
      `?api_key=${encodeURIComponent(apiKey)}`;

    // =========================================
    // 8. TẠO NỘI DUNG ĐƠN
    // =========================================

    const orderBody = {
      customer: {
        name: name.trim(),
        phone_number: cleanPhone,
      },

      shipping_address: {
        name: name.trim(),
        phone_number: cleanPhone,
        address: address.trim(),
      },

      note: [
        note ? `Ghi chú: ${note.trim()}` : "",
        `Nguồn: ${source || "landing-page-ot-gio"}`,
        created_at ? `Thời gian: ${created_at}` : "",
      ]
        .filter(Boolean)
        .join("\n"),

      items: [
        {
          name: productInfo.name,
          sku: productInfo.sku,
          quantity: productInfo.quantity,
          price: productInfo.price,
        },
      ],
    };

    console.log("PANCAKE REQUEST:", {
      customer: orderBody.customer,
      product: productInfo,
    });

    // =========================================
    // 9. GỬI ĐƠN SANG PANCAKE
    // =========================================

    const response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify(orderBody),
    });

    // =========================================
    // 10. ĐỌC RESPONSE
    // =========================================

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        raw: text,
      };
    }

    console.log("PANCAKE RESPONSE:", {
      status: response.status,
      data,
    });

    // =========================================
    // 11. PANCAKE TRẢ LỖI
    // =========================================

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Pancake từ chối tạo đơn",
        status: response.status,
        details: data,
      });
    }

    // =========================================
    // 12. THÀNH CÔNG
    // =========================================

    return res.status(200).json({
      success: true,
      message: "Đã gửi đơn hàng sang Pancake",

      order: {
        customer: name.trim(),
        phone: cleanPhone,
        address: address.trim(),

        product: productInfo.name,
        sku: productInfo.sku,
        quantity: productInfo.quantity,
        price: productInfo.price,
      },

      pancake: data,
    });

  } catch (error) {

    // =========================================
    // 13. LỖI SERVER
    // =========================================

    console.error("ORDER API ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Lỗi máy chủ khi gửi đơn hàng",
      message: error?.message || "Unknown error",
    });
  }
}