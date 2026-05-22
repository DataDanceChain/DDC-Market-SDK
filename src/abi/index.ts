/**
 * Contract ABIs for DDC Market
 */

import DDCNFTArtifact from './DDCNFT.json';
import DDCNFTFactoryArtifact from './DDCNFTFactory.json';
import MembershipArtifact from './Membership.json';
import MembershipFactoryArtifact from './MembershipFactory.json';
import AuthorizationArtifact from './Authorization.json';
import IDDCNFTAuthorizationArtifact from './IDDCNFTAuthorization.json';

// Export ABI arrays
export const DDCNFT_ABI = DDCNFTArtifact.abi;
export const DDCNFT_FACTORY_ABI = DDCNFTFactoryArtifact.abi;
export const MEMBERSHIP_ABI = MembershipArtifact.abi;
export const MEMBERSHIP_FACTORY_ABI = MembershipFactoryArtifact.abi;
/** Authorization 合约完整 ABI（含部署、常量、自定义 error） */
export const AUTHORIZATION_ABI = AuthorizationArtifact.abi;
/** IDDCNFTAuthorization 接口 ABI（用户授权读写） */
export const IDDCNFT_AUTHORIZATION_ABI = IDDCNFTAuthorizationArtifact.abi;

// Export full artifacts (including ABI)
export {
  DDCNFTArtifact,
  DDCNFTFactoryArtifact,
  MembershipArtifact,
  MembershipFactoryArtifact,
  AuthorizationArtifact,
  IDDCNFTAuthorizationArtifact,
};
