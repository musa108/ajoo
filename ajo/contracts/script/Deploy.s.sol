// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {AjoFactory} from "../src/AjoFactory.sol";
import {CreditPool} from "../src/CreditPool.sol";

/// @notice Deploys the whole Ajo system and writes addresses to deployments/<chainId>.json.
///
///   PRIVATE_KEY   deployer / owner key (required)
///   TOKEN         existing stablecoin address; if unset a MockUSD is deployed (testnet / demo only)
///
///   forge script script/Deploy.s.sol --rpc-url $RPC --broadcast
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address tokenAddr = vm.envOr("TOKEN", address(0));

        vm.startBroadcast(pk);

        bool mock;
        if (tokenAddr == address(0)) {
            tokenAddr = address(new MockUSD());
            mock = true;
        }
        ReputationRegistry reg = new ReputationRegistry(deployer);
        AjoFactory factory = new AjoFactory(address(reg), deployer);
        reg.setRegistrar(address(factory), true);
        factory.setTokenAllowed(tokenAddr, true);

        // $0.50 of credit per score point above the minimum (token decimals assumed to be 6)
        CreditPool pool = new CreditPool(tokenAddr, address(reg), deployer, 500_000);
        reg.setWriter(address(pool), true);

        vm.stopBroadcast();

        string memory j = "deployment";
        vm.serializeUint(j, "chainId", block.chainid);
        vm.serializeAddress(j, "token", tokenAddr);
        vm.serializeBool(j, "tokenIsMock", mock);
        vm.serializeAddress(j, "registry", address(reg));
        vm.serializeAddress(j, "factory", address(factory));
        vm.serializeAddress(j, "implementation", factory.implementation());
        vm.serializeAddress(j, "creditPool", address(pool));
        string memory out = vm.serializeAddress(j, "deployer", deployer);
        vm.writeJson(out, string.concat("./deployments/", vm.toString(block.chainid), ".json"));

        console2.log("token      ", tokenAddr);
        console2.log("registry   ", address(reg));
        console2.log("factory    ", address(factory));
        console2.log("creditPool ", address(pool));
    }
}
