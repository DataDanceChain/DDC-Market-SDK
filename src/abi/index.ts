/**
 * Contract ABIs for DDC Market
 */

import DDCNFTArtifact from './DDCNFT.json';
import DDCNFTFactoryArtifact from './DDCNFTFactory.json';
import MembershipArtifact from './Membership.json';
import MembershipFactoryArtifact from './MembershipFactory.json';

// Export ABI arrays
export const DDCNFT_ABI = DDCNFTArtifact.abi;
export const DDCNFT_FACTORY_ABI = DDCNFTFactoryArtifact.abi;
export const MEMBERSHIP_ABI = MembershipArtifact.abi;
export const MEMBERSHIP_FACTORY_ABI = MembershipFactoryArtifact.abi;

// Export full artifacts (including ABI)
export { DDCNFTArtifact, DDCNFTFactoryArtifact, MembershipArtifact, MembershipFactoryArtifact };
