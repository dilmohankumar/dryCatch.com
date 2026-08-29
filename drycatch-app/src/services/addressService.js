import api from "./api";

export async function fetchAddresses() {
  const { data } = await api.get("/addresses");
  return data.addresses;
}

export async function createAddress(payload) {
  const { data } = await api.post("/addresses", payload);
  return data.address;
}

export async function updateAddress(id, payload) {
  const { data } = await api.patch(`/addresses/${id}`, payload);
  return data.address;
}

export async function deleteAddress(id) {
  const { data } = await api.delete(`/addresses/${id}`);
  return data;
}

export async function setDefaultAddress(id, type = "both") {
  const { data } = await api.patch(`/addresses/${id}/default`, { type });
  return data.address;
}
