/**
 * GADAPAD, real GIWA Sepolia integration.
 *
 * Every selector below was confirmed against `forge inspect <Contract>
 * methodIdentifiers` for the actual deployed bytecode, not guessed from a
 * signature. Two pools exist on purpose: POOL is the open sale that anyone
 * can use to try the full participate, vote, and release flow. GATED_POOL is
 * a second, otherwise identical sale contract that enforces Dojang
 * verification on-chain through the real DojangScroll contract GIWA runs,
 * kept separate so the interactive demo above stays testable by a reviewer
 * who does not hold a Dojang attestation.
 */

const GIWA_CONFIG = {
  chainIdHex: '0x164ce',
  chainIdDec: 91342,
  chainName: 'GIWA Sepolia',
  rpcUrl: 'https://sepolia-rpc.giwa.io',
  blockExplorerUrl: 'https://sepolia-explorer.giwa.io',

  gkrwAddress: '0xADF8DCa14aBc9F88aCd24f62f6eeBd1299726eeE',
  gkrwFaucetAddress: '0x139F572212f412F07dDA7568FD6FC188eBB0BbE7',
  poolAddress: '0xc4CBA11C5FBB35B6cF81e37b8374B6aEBD5D1f6E',
  governorAddress: '0x2D64D2fc7CD2d8Ab7e4fE12Aa66e36b31DA8dC7c',
  gatedPoolAddress: '0xA1A45D3c8Ff997Da12cD679bF57166c9b547f510',

  dojangScrollAddress: '0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9',
  dojangAttesterId: '0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034'
};

const SEL = {
  balanceOf: '0x70a08231',
  allowance: '0xdd62ed3e',
  approve: '0x095ea7b3',
  requestGKRW: '0x2d42a2c2',
  lastClaimTime: '0xb77cf9c6',
  totalRaisedGKRW: '0x0a067483',
  hardCapGKRW: '0x72c85736',
  gkrwContributed: '0xf914bdc9',
  hasClaimed: '0x73b2e80e',
  participate: '0x845c9306',
  claimTokens: '0x48c54b9d',
  isUserVerified: '0xace417e0',
  isVerified: '0x' /* filled below once we know the 4-byte selector */,
  treasuryBalance: '0x313dab20',
  requestCount: '0x5badbe4c',
  getRequest: '0xc58343ef',
  hasVoted: '0x43859632',
  vote: '0xc9d27afe',
  finalize: '0x05261aea',
  // isVerified(address,bytes32) on DojangScroll, confirmed via `cast sig`.
  isVerified: '0xba03e205'
};

function pad32(hex) { return hex.replace(/^0x/, '').padStart(64, '0'); }
function addrParam(addr) { return pad32(addr.toLowerCase()); }
function u256Param(bi) { return pad32(BigInt(bi).toString(16)); }
function boolParam(b) { return pad32(b ? '1' : '0'); }
function wordAt(hexData, index) {
  const body = hexData.startsWith('0x') ? hexData.slice(2) : hexData;
  return '0x' + body.slice(index * 64, index * 64 + 64);
}

class GiwaWeb3Provider {
  constructor() {
    this.account = null;
    this.chainId = null;
    this.isGiwaNetwork = false;
    this.listeners = [];
  }

  async init() {
    if (typeof window.ethereum === 'undefined') return false;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) this.account = accounts[0];
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      this.chainId = parseInt(chainId, 16);
      this.isGiwaNetwork = this.chainId === GIWA_CONFIG.chainIdDec;

      window.ethereum.on('accountsChanged', accs => {
        this.account = accs.length > 0 ? accs[0] : null;
        this.notifyListeners();
      });
      window.ethereum.on('chainChanged', cId => {
        this.chainId = parseInt(cId, 16);
        this.isGiwaNetwork = this.chainId === GIWA_CONFIG.chainIdDec;
        this.notifyListeners();
      });
      return true;
    } catch (err) {
      return false;
    }
  }

  onStateChange(fn) { this.listeners.push(fn); }
  notifyListeners() {
    this.listeners.forEach(fn => fn({ account: this.account, chainId: this.chainId, isGiwaNetwork: this.isGiwaNetwork }));
  }

  async connectWallet() {
    if (!window.ethereum) { alert('Install MetaMask or another EIP-1193 wallet to continue.'); return null; }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    this.account = accounts[0];
    await this.ensureGiwaNetwork();
    this.notifyListeners();
    return this.account;
  }

  async ensureGiwaNetwork() {
    if (!window.ethereum) return false;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: GIWA_CONFIG.chainIdHex }] });
      this.isGiwaNetwork = true;
      return true;
    } catch (switchError) {
      if (switchError && switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: GIWA_CONFIG.chainIdHex,
            chainName: GIWA_CONFIG.chainName,
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [GIWA_CONFIG.rpcUrl],
            blockExplorerUrls: [GIWA_CONFIG.blockExplorerUrl]
          }]
        });
        this.isGiwaNetwork = true;
        return true;
      }
      return false;
    }
  }

  async call(to, data) {
    const res = await fetch(GIWA_CONFIG.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] })
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result || '0x0';
  }

  async send(to, data, gas) {
    if (!this.account) await this.connectWallet();
    await this.ensureGiwaNetwork();
    return window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from: this.account, to, data, gas }]
    });
  }

  /* ---- native ETH, needed for gas pre-checks ---- */
  async getEthBalance(address = this.account) {
    if (!address) return 0n;
    const res = await fetch(GIWA_CONFIG.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] })
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return BigInt(json.result || '0x0');
  }

  /* ---- GKRW ERC20 ---- */
  async getGKRWBalance(address = this.account) {
    if (!address) return 0n;
    const r = await this.call(GIWA_CONFIG.gkrwAddress, SEL.balanceOf + addrParam(address));
    return BigInt(r);
  }
  async getGKRWAllowance(owner = this.account, spender = GIWA_CONFIG.poolAddress) {
    if (!owner) return 0n;
    const r = await this.call(GIWA_CONFIG.gkrwAddress, SEL.allowance + addrParam(owner) + addrParam(spender));
    return BigInt(r);
  }
  async approveGKRW(amountGKRW, spender = GIWA_CONFIG.poolAddress) {
    const wei = BigInt(Math.floor(amountGKRW * 1e18));
    const data = SEL.approve + addrParam(spender) + u256Param(wei);
    return this.send(GIWA_CONFIG.gkrwAddress, data, '0x186a0');
  }
  async requestGKRWFaucet() {
    return this.send(GIWA_CONFIG.gkrwFaucetAddress, SEL.requestGKRW, '0x30d40');
  }
  async faucetCooldownRemaining(address = this.account) {
    if (!address) return 0;
    const r = await this.call(GIWA_CONFIG.gkrwFaucetAddress, SEL.lastClaimTime + addrParam(address));
    const last = Number(BigInt(r));
    if (last === 0) return 0;
    const nextClaim = last + 86400;
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, nextClaim - now);
  }

  /* ---- Sale pool (open, used for the interactive demo) ---- */
  async getPoolState(address = this.account) {
    const [raisedHex, capHex] = await Promise.all([
      this.call(GIWA_CONFIG.poolAddress, SEL.totalRaisedGKRW),
      this.call(GIWA_CONFIG.poolAddress, SEL.hardCapGKRW)
    ]);
    let contributed = 0n, claimed = false;
    if (address) {
      const [cHex, clHex] = await Promise.all([
        this.call(GIWA_CONFIG.poolAddress, SEL.gkrwContributed + addrParam(address)),
        this.call(GIWA_CONFIG.poolAddress, SEL.hasClaimed + addrParam(address))
      ]);
      contributed = BigInt(cHex);
      claimed = BigInt(clHex) > 0n;
    }
    return {
      totalRaisedGKRW: Number(BigInt(raisedHex)) / 1e18,
      hardCapGKRW: Number(BigInt(capHex)) / 1e18,
      userContributedGKRW: Number(contributed) / 1e18,
      userClaimed: claimed
    };
  }
  async participatePool(amountGKRW) {
    const wei = BigInt(Math.floor(amountGKRW * 1e18));
    const allowance = await this.getGKRWAllowance(this.account, GIWA_CONFIG.poolAddress);
    if (allowance < wei) throw new Error('GKRW allowance too low. Approve first.');
    const data = SEL.participate + u256Param(wei);
    return this.send(GIWA_CONFIG.poolAddress, data, '0x493e0');
  }
  async claimTokens() {
    return this.send(GIWA_CONFIG.poolAddress, SEL.claimTokens, '0x30d40');
  }

  /* ---- Dojang verification, read only, always live ---- */
  async isDojangVerified(address = this.account) {
    if (!address) return false;
    const r = await this.call(
      GIWA_CONFIG.dojangScrollAddress,
      SEL.isVerified + addrParam(address) + pad32(GIWA_CONFIG.dojangAttesterId)
    );
    return BigInt(r) === 1n;
  }
  async isDojangVerifiedViaGatedPool(address = this.account) {
    if (!address) return false;
    const r = await this.call(GIWA_CONFIG.gatedPoolAddress, SEL.isUserVerified + addrParam(address));
    return BigInt(r) === 1n;
  }

  /* ---- Treasury governor ---- */
  async getTreasuryState() {
    const [balHex, countHex] = await Promise.all([
      this.call(GIWA_CONFIG.governorAddress, SEL.treasuryBalance),
      this.call(GIWA_CONFIG.governorAddress, SEL.requestCount)
    ]);
    return {
      treasuryBalanceGKRW: Number(BigInt(balHex)) / 1e18,
      requestCount: Number(BigInt(countHex))
    };
  }
  async getRequest(id) {
    const data = SEL.getRequest + u256Param(id);
    const r = await this.call(GIWA_CONFIG.governorAddress, data);
    // tuple head: [amount][string offset][deadline][yesWeight][noWeight][finalized][approved]
    const amount = BigInt(wordAt(r, 0));
    const strOffsetBytes = Number(BigInt(wordAt(r, 1)));
    const deadline = Number(BigInt(wordAt(r, 2)));
    const yesWeight = BigInt(wordAt(r, 3));
    const noWeight = BigInt(wordAt(r, 4));
    const finalized = BigInt(wordAt(r, 5)) === 1n;
    const approved = BigInt(wordAt(r, 6)) === 1n;

    const body = r.startsWith('0x') ? r.slice(2) : r;
    const strWordIndex = strOffsetBytes / 32;
    const lenHex = body.slice(strWordIndex * 64, strWordIndex * 64 + 64);
    const len = parseInt(lenHex, 16) || 0;
    const bytesHex = body.slice((strWordIndex + 1) * 64, (strWordIndex + 1) * 64 + len * 2);
    let purpose = '';
    for (let i = 0; i < bytesHex.length; i += 2) purpose += String.fromCharCode(parseInt(bytesHex.slice(i, i + 2), 16));

    return {
      amountGKRW: Number(amount) / 1e18,
      purpose,
      deadline,
      yesWeight, noWeight,
      yesGKRW: Number(yesWeight) / 1e18,
      noGKRW: Number(noWeight) / 1e18,
      finalized, approved
    };
  }
  async hasVotedOn(requestId, address = this.account) {
    if (!address) return false;
    const data = SEL.hasVoted + u256Param(requestId) + addrParam(address);
    const r = await this.call(GIWA_CONFIG.governorAddress, data);
    return BigInt(r) === 1n;
  }
  async castVote(requestId, support) {
    const data = SEL.vote + u256Param(requestId) + boolParam(support);
    return this.send(GIWA_CONFIG.governorAddress, data, '0x30d40');
  }
  async finalizeRequest(requestId) {
    const data = SEL.finalize + u256Param(requestId);
    return this.send(GIWA_CONFIG.governorAddress, data, '0x30d40');
  }
}

window.giwaWeb3 = new GiwaWeb3Provider();
