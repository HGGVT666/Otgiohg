export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method Not Allowed" });
  try {
    const { name, phone, address, product, note } = req.body || {};
    if (!name || !phone || !address || !product) return res.status(400).json({ success: false, error: "Thiếu thông tin đặt hàng" });
    const apiKey = process.env.PANCAKE_API_KEY;
    const shopId = process.env.PANCAKE_SHOP_ID;
    if (!apiKey || !shopId) return res.status(500).json({ success: false, error: "Thiếu cấu hình Pancake" });
    let cleanPhone = String(phone).replace(/\s+/g, "").replace(/[().-]/g, "");
    if (cleanPhone.startsWith("+84")) cleanPhone = "0" + cleanPhone.slice(3);
    if (!/^0\d{9}$/.test(cleanPhone)) return res.status(400).json({ success: false, error: "Số điện thoại không đúng định dạng" });

    const baseUrl = "https://pos.pages.fm/api/v1/shops/" + encodeURIComponent(shopId);
    const request = async (path) => {
      const response = await fetch(baseUrl + path + (path.includes("?") ? "&" : "?") + "api_key=" + encodeURIComponent(apiKey), { headers: { Accept: "application/json" } });
      const text = await response.text();
      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (!response.ok) throw new Error("Pancake " + response.status + ": " + JSON.stringify(data));
      return data;
    };
    const list = (value) => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : Array.isArray(value?.warehouses) ? value.warehouses : [];
    const normalise = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const warehouseData = await request("/warehouses");
    const warehouse = list(warehouseData).find((item) => normalise(item.code || item.warehouse_code) === "nhatanh01" || normalise(item.name || item.warehouse_name).includes("nhat anh"));
    const warehouseId = warehouse && (warehouse.id || warehouse.warehouse_id || warehouse._id);
    if (!warehouseId) return res.status(422).json({ success: false, error: "Không tìm thấy kho Nhật Anh (nhatanh01) trong Pancake" });

    const variationData = await request("/products/variations?page_number=1&page_size=100");
    const variations = list(variationData);
    const selectedName = normalise(product);
    const variation = variations.find((item) => {
      const name = normalise((item.product && item.product.name) || item.product_name || item.name);
      return name.includes("ot gio") && (name.includes("350") || selectedName.includes("350"));
    });
    if (!variation || !(variation.product_id || variation.product?.id) || !variation.id) {
      return res.status(422).json({ success: false, error: "Không tìm thấy sản phẩm/biến thể Ớt Gió 350ml trong Pancake" });
    }

    const quantity = product.includes("Combo 3") ? 3 : product.includes("Combo 2") ? 2 : 1;
    const totalPrice = product.includes("Combo 3") ? 489000 : product.includes("Combo 2") ? 349000 : 189000;
    const basePrice = Number(variation.retail_price || variation.price_at_counter || variation.product?.retail_price || totalPrice);
    const discountEachProduct = Math.max(0, Math.round((basePrice * quantity - totalPrice) / quantity));
    const orderBody = {
      bill_full_name: name,
      bill_phone_number: cleanPhone,
      warehouse_id: warehouseId,
      shipping_address: { full_name: name, phone_number: cleanPhone, address },
      note: note || "",
      shipping_fee: 0,
      is_free_shipping: false,
      received_at_shop: false,
      total_discount: discountEachProduct * quantity,
      items: [{ product_id: variation.product_id || variation.product.id, variation_id: variation.id, quantity, discount_each_product: discountEachProduct, is_bonus_product: false, is_discount_percent: false, is_wholesale: false, one_time_product: false, variation_info: { ...variation, retail_price: basePrice } }]
    };
    const response = await fetch(baseUrl + "/orders?api_key=" + encodeURIComponent(apiKey), { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(orderBody) });
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!response.ok) return res.status(502).json({ success: false, error: "Pancake từ chối tạo đơn", pancake_status: response.status, pancake_response: data });
    return res.status(200).json({ success: true, message: "Đã tạo đơn Pancake thành công", warehouse: { id: warehouseId, code: warehouse.code || "nhatanh01", name: warehouse.name || "shop Nhật Anh" }, order: data });
  } catch (error) {
    console.error("Pancake order error", error);
    return res.status(500).json({ success: false, error: "Lỗi máy chủ", message: error.message || "Unknown error" });
  }
}
