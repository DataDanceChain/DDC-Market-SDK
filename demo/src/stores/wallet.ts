import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import type { Signer } from 'ethers'

type Nullable<T> = T | null


export const useWalletStore = defineStore('wallet', {
  state: () => ({
    walletAddress: '' as string,
    privateKey: '' as string,
    connected: false as boolean,
    connectionType: '' as 'metamask' | 'privatekey' | '',
    provider: null as any,
    chainName: '' as string,
    // signer: null as Nullable<Signer>,
  }),
  actions: {
    setConnection(params: {
      provider: any
      signer: Signer
      walletAddress: string
      privateKey?: string
      connectionType?: 'metamask' | 'privatekey'
      chainName?: string
    }) {
      // Store simple data in state
      this.walletAddress = params.walletAddress
      this.privateKey = params.privateKey ?? ''
      this.connectionType = params.connectionType ?? 'metamask'
      this.connected = true
      // Use markRaw to prevent Vue from making provider/signer reactive
      // This avoids Proxy wrapping which causes "Receiver must be an instance of class anonymous" errors
      this.provider = markRaw(params.provider)
      this.chainName = params.chainName ?? ''
      // this.signer = markRaw(params.signer)
    },
    setChainName(chainName: string) {
      this.chainName = chainName
    },
    clear() {
      // Clear state
      this.walletAddress = ''
      this.connectionType = ''
      this.connected = false
      this.provider = null
      // this.signer = null
      this.chainName = ''
    },
  },
})


