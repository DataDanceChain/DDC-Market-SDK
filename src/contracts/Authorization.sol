// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

//  合约目标提供: 授权合约调用 签名 查询 权限校验 撤销授权 能力
//  合约实现要求: 合约健壮性强 性能好 兼顾优化 gas 费用成本

// 1.  合约职责
// Authorization Contract 负责:
// 1. 记录用户对第三方的授权关系。
// 2. 记录授权有效期。
// 3. 支持用户撤销授权。
// 4. 支持第三方授权状态查询。
// 5. 发出标准事件，供 Indexer / API / Analytics 监听。
//
// 注:第三方白名单治理由 DDC 链下(后端 API / Indexer 过滤)承担,
//     本合约不做链上白名单约束,以最大化 gas 效率与用户主权。

/*//////////////////////////////////////////////////////////////
                              类型
//////////////////////////////////////////////////////////////*/

/**
 * @notice 用户授权信息(查询返回)
 * @param authorized        当前是否有效授权
 * @param expiresAt         授权到期 unix 时间戳(秒)
 * @param remainingSeconds  距离到期剩余秒数(到期/未授权返回 0)
 */
struct UserAuthorization {
  bool authorized;
  uint64 expiresAt;
  uint64 remainingSeconds;
}

/*//////////////////////////////////////////////////////////////
                            合约接口
//////////////////////////////////////////////////////////////*/

interface IDDCNFTAuthorization {
  event Authorized(address indexed wallet, bytes32 indexed siteId, uint64 expiresAt);
  event Revoked(address indexed wallet, bytes32 indexed siteId);
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  function authorize(bytes32 siteId, uint64 durationSeconds) external;

  function revoke(bytes32 siteId) external;

  function isAuthorized(address wallet, bytes32 siteId) external view returns (bool);

  function getAuthorization(
    address wallet,
    bytes32 siteId
  ) external view returns (UserAuthorization memory);
}

/*//////////////////////////////////////////////////////////////
                              合约
//////////////////////////////////////////////////////////////*/

/**
 * @title  Authorization
 * @notice DDC NFT 第三方站点授权管理合约。
 *         用户可对任意第三方站点(由 DDC 链下治理)授予/撤销有限期访问权限。
 * @dev    设计要点:
 *          - 自定义 error 替代 require 字符串以节省 gas
 *          - 直接使用 uint64 存储到期时间,单 slot 读写
 *          - 写入路径仅一次 SSTORE,撤销使用 delete 释放退款
 *          - 保留 owner 字段供未来治理/升级使用,不参与用户接口逻辑(零 gas 影响)
 */
contract Authorization is IDDCNFTAuthorization {
  /*//////////////////////////////////////////////////////////////
                                常量
    //////////////////////////////////////////////////////////////*/

  /// @notice 单次授权最大有效期(365 天),防止用户误传过大值
  uint64 public constant MAX_DURATION = 365 days;

  /// @notice 单次授权最小有效期,避免无意义授权
  uint64 public constant MIN_DURATION = 60; // 1 分钟

  /*//////////////////////////////////////////////////////////////
                                存储
    //////////////////////////////////////////////////////////////*/

  /// @notice 合约所有者(治理/升级保留接口,不参与用户授权逻辑)
  address public owner;

  /// @notice 用户对站点的授权到期时间: wallet => siteId => expiresAt(0 表示未授权)
  mapping(address => mapping(bytes32 => uint64)) private _expiresAt;

  /*//////////////////////////////////////////////////////////////
                              自定义错误
    //////////////////////////////////////////////////////////////*/

  error NotOwner();
  error ZeroAddress();
  error InvalidSiteId();
  error DurationOutOfRange(uint64 duration);
  error NotAuthorized();

  /*//////////////////////////////////////////////////////////////
                              修饰器
    //////////////////////////////////////////////////////////////*/

  modifier onlyOwner() {
    if (msg.sender != owner) revert NotOwner();
    _;
  }

  /*//////////////////////////////////////////////////////////////
                              构造函数
    //////////////////////////////////////////////////////////////*/

  constructor(address initialOwner) {
    if (initialOwner == address(0)) revert ZeroAddress();
    owner = initialOwner;
    emit OwnershipTransferred(address(0), initialOwner);
  }

  /*//////////////////////////////////////////////////////////////
                            管理员接口
    //////////////////////////////////////////////////////////////*/

  /**
   * @notice 转移合约所有权
   * @param  newOwner 新所有者地址(不能为零地址)
   */
  function transferOwnership(address newOwner) external onlyOwner {
    if (newOwner == address(0)) revert ZeroAddress();
    address prev = owner;
    owner = newOwner;
    emit OwnershipTransferred(prev, newOwner);
  }

  /*//////////////////////////////////////////////////////////////
                            用户接口
    //////////////////////////////////////////////////////////////*/

  /**
   * @notice 用户授予某站点 durationSeconds 秒的访问权限
   * @param  siteId          第三方站点 ID
   * @param  durationSeconds 授权有效期(秒)
   * @dev    若已存在授权,本次操作覆盖原过期时间为 now + duration
   *         block.timestamp(uint64) + duration(<= 365 days) 不会溢出 uint64
   */
  function authorize(bytes32 siteId, uint64 durationSeconds) external {
    if (siteId == bytes32(0)) revert InvalidSiteId();
    if (durationSeconds < MIN_DURATION || durationSeconds > MAX_DURATION) {
      revert DurationOutOfRange(durationSeconds);
    }

    uint64 expiresAt;
    unchecked {
      expiresAt = uint64(block.timestamp) + durationSeconds;
    }

    _expiresAt[msg.sender][siteId] = expiresAt;

    emit Authorized(msg.sender, siteId, expiresAt);
  }

  /**
   * @notice 用户撤销对某站点的授权
   * @param  siteId 第三方站点 ID
   * @dev    使用 delete 触发存储退款
   */
  function revoke(bytes32 siteId) external {
    if (siteId == bytes32(0)) revert InvalidSiteId();
    if (_expiresAt[msg.sender][siteId] == 0) revert NotAuthorized();

    delete _expiresAt[msg.sender][siteId];
    emit Revoked(msg.sender, siteId);
  }

  /*//////////////////////////////////////////////////////////////
                            查询接口
    //////////////////////////////////////////////////////////////*/

  /**
   * @notice 判断指定 wallet 对 siteId 的授权是否仍有效
   */
  function isAuthorized(address wallet, bytes32 siteId) external view returns (bool) {
    return _expiresAt[wallet][siteId] > uint64(block.timestamp);
  }

  /**
   * @notice 查询指定 wallet 对 siteId 的完整授权信息
   */
  function getAuthorization(
    address wallet,
    bytes32 siteId
  ) external view returns (UserAuthorization memory result) {
    uint64 expiresAt = _expiresAt[wallet][siteId];
    uint64 nowTs = uint64(block.timestamp);
    bool active = expiresAt > nowTs;

    result.authorized = active;
    result.expiresAt = expiresAt;
    unchecked {
      result.remainingSeconds = active ? (expiresAt - nowTs) : 0;
    }
  }
}
