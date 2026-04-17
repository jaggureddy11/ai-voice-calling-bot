require('dotenv').config();
const { createCall } = require('../src/services/exotelService');
async function test() {
  try {
    const sid = await createCall("+918899889988", "1234");
    console.log("Success:", sid);
  } catch (e) {
    if (e.response && e.response.data) {
        console.log("Exotel API Error:", e.response.data);
    } else {
        console.log("Error:", e.message);
    }
  }
}
test();
