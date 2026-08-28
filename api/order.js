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

    if (!/^0\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        error: "Số điện thoại không đúng định dạng",
      });
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
    // 5. LẤY DANH SÁCH KHO PANCAKE
    // ==============================

    const warehouseUrl =
      `https://pos.pages.fm/api/v1/shops/${shopId}/warehouses` +
      `?api_key=${encodeURIComponent(apiKey)}`;

    console.log("========== GET WAREHOUSES ==========");
    console.log("SHOP ID:", shopId);

    const warehouseResponse = await fetch(warehouseUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const warehouseText = await warehouseResponse.text();

    let warehouseData;

    try {
      warehouseData = JSON.parse(warehouseText);
    } catch {
      warehouseData = {
        raw: warehouseText,
      };
    }

    console.log("WAREHOUSE STATUS:", warehouseResponse.status);
    console.log(
      "WAREHOUSE RESPONSE:",
      JSON.stringify(warehouseData, null, 2)
    );

    if (!warehouseResponse.ok) {
      return res.status(400).json({
        success: false,
        error: "Không lấy được danh sách kho Pancake",
        pancake_status: warehouseResponse.status,
        pancake_response: warehouseData,
      });
    }

    // ==============================
    // 6. TÌM KHO SHOP NHẬT ANH
    // ==============================

    let warehouses = [];

    if (Array.isArray(warehouseData)) {
      warehouses = warehouseData;
    } else if (Array.isArray(warehouseData.data)) {
      warehouses = warehouseData.data;
    } else if (Array.isArray(warehouseData.warehouses)) {
      warehouses = warehouseData.warehouses;
    } else if (Array.isArray(warehouseData.data?.warehouses)) {
      warehouses = warehouseData.data.warehouses;
    }

    console.log("WAREHOUSES FOUND:", warehouses);

    const warehouse = warehouses.find((w) => {
      const name = String(
        w.name ||
        w.warehouse_name ||
        ""
      ).toLowerCase();

      const code = String(
        w.code ||
        w.warehouse_code ||
        ""
      ).toLowerCase();

      return (
        code === "nhatanh01" ||
        name.includes("shop nhật anh") ||
        name.includes("nhat anh")
      );
    });

    if (!warehouse) {
      return res.status(400).json({
        success: false,
        error: "Không tìm thấy kho shop Nhật Anh",
        warehouse_code_expected: "nhatanh01",
        warehouses_received: warehouses,
      });
    }

    const warehouseId =
      warehouse.id ||
      warehouse.warehouse_id ||
      warehouse._id;

    if (!warehouseId) {
      return res.status(400).json({
        success: false,
        error: "Tìm thấy kho nhưng không có Warehouse ID",
        warehouse_found: warehouse,
      });
    }

    console.log("========== WAREHOUSE SELECTED ==========");
    console.log("WAREHOUSE NAME:", warehouse.name);
    console.log("WAREHOUSE CODE:", warehouse.code);
    console.log("WAREHOUSE ID:", warehouseId);

    // ==============================
    // 7. URL TẠO ĐƠN PANCAKE
    // ==============================

    const orderUrl =
      `https://pos.pages.fm/api/v1/shops/${shopId}/orders` +
      `?api_key=${encodeURIComponent(apiKey)}`;

    // ==============================
    // 8. BODY TẠO ĐƠN
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

      warehouse_id: warehouseId,

      note: note || "",

      items: [
        {
          name: productName,
          quantity: 1,
          price: price,
        },
      ],
    };

    console.log("========== PANCAKE ORDER REQUEST ==========");
    console.log(JSON.stringify(orderBody, null, 2));

    // ==============================
    // 9. GỌI PANCAKE TẠO ĐƠN
    // ==============================

    const response = await fetch(orderUrl, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify(orderBody),
    });

    // ==============================
    // 10. ĐỌC RESPONSE
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
    // 11. PANCAKE TỪ CHỐI
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
          warehouse_id: warehouseId,
          warehouse_code: "nhatanh01",
          note,
        },
      });
    }

    // ==============================
    // 12. THÀNH CÔNG
    // ==============================

    return res.status(200).json({
      success: true,

      message: "Đã tạo đơn Pancake thành công",

      warehouse: {
        id: warehouseId,
        code: warehouse.code || "nhatanh01",
        name: warehouse.name || "shop Nhật Anh",
      },

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
