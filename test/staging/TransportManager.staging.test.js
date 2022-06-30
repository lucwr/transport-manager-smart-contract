const { assert } = require("chai");
const { getNamedAccounts, ethers, network } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("TransportManager", async function () {
          let transportManager;
          let deployer;
          let sendValue = ethers.utils.parseEther("0.05");
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              transportManager = await ethers.getContract(
                  "TransportManager",
                  deployer
              );
          });
          it("should fund, start trip and withdraw", async function () {
              await transportManager.fundWallet({ value: sendValue });
              const tripCode1 = await transportManager.getTripCode(1);
              const tripCode2 = await transportManager.getTripCode(4);
              const tripCost1 = await transportManager.getTripSchedule(
                  tripCode1
              );
              const tripCost2 = await transportManager.getTripSchedule(
                  tripCode2
              );
              await transportManager.startTrip({
                  gasLimit: 100000,
                  value: tripCode1,
              });
              await transportManager.startTrip({
                  gasLimit: 100000,
                  value: tripCode2,
              });
              const openingBalance = await transportManager.getBalance();
              await transportManager.withdraw({ gasLimit: 100000 });
              const closingBalance = await transportManager.getBalance();

              assert.equal(
                  tripCost1.add(tripCost2).toString(),
                  openingBalance.toString()
              );
              assert.equal(closingBalance.toString(), "0");
          });
      });
