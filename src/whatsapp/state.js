export let sock = null
export let qrCodeData = null
export let isConnected = false

export function setSock(s) {
  sock = s
}

export function setQR(qr) {
  qrCodeData = qr
}

export function setConnection(status) {
  isConnected = status
}
