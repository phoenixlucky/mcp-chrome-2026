// DNS fix for WXT build — set public DNS servers to avoid ECONNREFUSED
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
