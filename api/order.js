export default async function handler(req, res) {
  // Chỉ nhận POST
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
    // 1. KIỂM TRA THÔNG TIN KHÁCH
    // ==============================

    if (!name || !phone || !address) {
      return res.status(400).json({
        success: false,
        error: "Thiếu họ tên, số điện thoại hoặc địa chỉ",
      });
    }

    // ==============================
    // 2. LẤY CẤU HÌNH PANCAKE
    // ==============================

    const apiKey = process.env.PANCAKE_API_KEY;
    const shopId = process.env.PANCAKE_SHOP_ID;

    if (!apiKey || !shopId) {
      return res.status(500).json({
        success: false,
        error: "Chưa cấu hình Pancake API Key hoặc Shop ID",
      });
    }

    // ==============================
    // 3. SẢN PHẨM MẶC ĐỊNH
    // ==============================

    // Sản phẩm anh vừa tạo trên Pancake
    const productCode = "OTG350";
    const productName =
      product || "Ớt Gió Ngâm Dấm Nho Quế 350ml";

    // ==============================
    // 4. TẠO ĐƠN HÀNG
    // ==============================

    const url =
      `https://pos.pages.fm/api/v1/shops/${shopId}/orders` +
      `?api_key=${encodeURIComponent(apiKey)}`;

    const orderBody = {
      customer: {
        name: name,
        phone_number: phone,
      },

      shipping_address: {
        name: name,
        phone_number: phone,
        address: address,
      },

      note: note || "",

      items: [
        {
          name: productName,
          sku: productCode,
          quantity: 1,
          price: 189000,
        },
      ],
    };

    // ==============================
    // 5. GỬI SANG PANCAKE
    // ==============================

    const response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(orderBody),
    });

    // Đọc response an toàn
    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        raw: text,
      };
    }

    // ==============================
    // 6. PANCAKE TRẢ LỖI
    // ==============================

    if (!response.ok) {
      console.error("PANCAKE ERROR:", {
        status: response.status,
        data: data,
      });

      return res.status(response.status).json({
        success: false,
        error: "Pancake từ chối tạo đơn",
        status: response.status,
        details: data,
      });
    }

    // ==============================
    // 7. THÀNH CÔNG
    // ==============================

    console.log("PANCAKE ORDER SUCCESS:", data);

    return res.status(200).json({
      success: true,
      message: "Đã gửi đơn hàng sang Pancake",
      order: data,
    });

  } catch (error) {
    // ==============================
    // 8. LỖI SERVER
    // ==============================

    console.error("ORDER API ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Lỗi máy chủ khi gửi đơn hàng",
      message: error?.message || "Unknown error",
    });
  }
}
