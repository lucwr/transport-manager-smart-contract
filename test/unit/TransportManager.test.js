const { assert, expect } = require("chai");
const { deployments, getNamedAccounts, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("TransportManager", async function () {
          let transportManager;
          let deployer;
          let sendValue = ethers.utils.parseEther("0.1");
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);
              transportManager = await ethers.getContract(
                  "TransportManager",
                  deployer
              );
          });

          describe("constructor", async function () {
              it("should set contractDeployer", async function () {
                  const response = await transportManager.getContractDeployer();
                  assert.equal(response, deployer);
              });

              it("should set tripSchedule", async function () {
                  for (let index = 0; index < 5; index++) {
                      const tripCode = await transportManager.getTripCode(
                          index
                      );
                      const tripCost = await transportManager.getTripCost(
                          index
                      );
                      const tripSchedule =
                          await transportManager.getTripSchedule(tripCode);
                      assert.equal(
                          tripSchedule.toString(),
                          tripCost.toString()
                      );
                  }
              });
          });

          // describe("receive & fallback", async function () {
          //     it("should call receive", async function () {});

          //     it("should call fallback", async function () {
          //         await expect(
          //             transportManager.sendTransaction({
          //                 value: sendValue,
          //             })
          //         ).to.be.revertedWith("TransportManager__Fallback");
          //     });
          // });

          describe("fund", async function () {
              it("should not fund wallet if the deposit is below the minimum", async function () {
                  await expect(
                      transportManager.fundWallet()
                  ).to.be.revertedWith("TransportManager__InsufficientDeposit");
              });

              it("should update passenger", async function () {
                  await transportManager.fundWallet({ value: sendValue });
                  const response = await transportManager.getPassenger(
                      deployer
                  );
                  assert(response.toString(), sendValue);
              });

              it("should update passengers", async function () {
                  await transportManager.fundWallet({ value: sendValue });
                  const response = await transportManager.getPassengers(0);
                  assert(response.toString(), deployer);
              });
          });

          describe("withdrawal", async function () {
              beforeEach(async function () {
                  if (
                      this.currentTest.title ===
                      "should not withdraw with zero balance"
                  ) {
                      return;
                  }
                  await transportManager.fundWallet({ value: sendValue });
                  const tripCode = await transportManager.getTripCode(0);
                  await transportManager.startTrip(tripCode);
              });

              it("should not withdraw with zero balance", async function () {
                  await expect(transportManager.withdraw()).to.be.revertedWith(
                      "TransportManager__BalanceIsZero"
                  );
              });

              it("should fail if not owner", async function () {
                  const accounts = await ethers.getSigners();
                  const newTransportManager = await transportManager.connect(
                      accounts[1]
                  );
                  await expect(
                      newTransportManager.withdraw()
                  ).to.be.revertedWith("TransportManager__NotOwner");
              });

              it("should withdraw successfully", async function () {
                  await transportManager.withdraw();
                  const balance = await transportManager.getBalance();
                  assert(balance.toString(), 0);
              });
          });

          describe("start trip", async function () {
              it("failed with invalid trip code", async function () {
                  await transportManager.fundWallet({ value: sendValue });
                  await expect(
                      transportManager.startTrip("LODSAA")
                  ).to.be.revertedWith("TransportManager__InvalidTripCode");
              });

              it("failed with insufficient balance", async function () {
                  const tripCode = await transportManager.getTripCode(0);
                  await expect(
                      transportManager.startTrip(tripCode)
                  ).to.be.revertedWith("TransportManager__InsufficientBalance");
              });

              it("should start trip", async function () {
                  await transportManager.fundWallet({ value: sendValue });
                  const tripCode = await transportManager.getTripCode(0);
                  const tripCost = await transportManager.getTripSchedule(
                      tripCode
                  );
                  const startingDeployerBalance =
                      await transportManager.checkBalance();
                  const transactionResponse = await transportManager.startTrip(
                      tripCode
                  );
                  const transactionReceipt = await transactionResponse.wait(1);
                  const { gasUsed, effectiveGasPrice } = transactionReceipt;
                  const gasCost = gasUsed.mul(effectiveGasPrice);
                  const closingDeployerBalance =
                      await transportManager.checkBalance();
                  const closingContractBalance =
                      await transportManager.getBalance();

                  assert(
                      closingDeployerBalance
                          .add(tripCost)
                          .add(gasCost)
                          .toString(),
                      startingDeployerBalance.toString()
                  );
                  assert(closingContractBalance.toString(), tripCost);
              });

              it("should update trips", async function () {
                  await transportManager.fundWallet({ value: sendValue });
                  const tripCode = await transportManager.getTripCode(0);
                  const tripCost = await transportManager.getTripSchedule(
                      tripCode
                  );
                  await transportManager.startTrip(tripCode);
                  const trips = await transportManager.getTrips(0);
                  assert(trips.passenger.toString(), deployer);
                  assert(trips.tripCode.toString(), tripCode);
                  assert(trips.price.toString(), tripCost);
              });
          });

          describe("staff recorder", async function () {
              let initialStaffRecordNumber;
              let finalStaffRecordNumber;
              let staffRecord;
              let staffRecords;

              beforeEach(async function () {
                  initialStaffRecordNumber =
                      await transportManager.getStaffRecordNumber();
                  await transportManager.staffRecorder();
                  finalStaffRecordNumber =
                      await transportManager.getStaffRecordNumber();
                  staffRecords = await transportManager.getStaffRecords(0);
                  staffRecord = await transportManager.getStaffRecord(deployer);
              });

              it("should increase staff recorder number", async function () {
                  assert(
                      initialStaffRecordNumber.add(1).toString(),
                      finalStaffRecordNumber.toString()
                  );
              });

              it("should set staff record and records", async function () {
                  assert(staffRecords.toString(), deployer);
                  assert.notEqual(staffRecord.toString(), null);
              });

              it("should fail if called more than once in 24 hours", async function () {
                  await expect(
                      transportManager.staffRecorder()
                  ).to.be.revertedWith("TransportManager__LogOnceIn24Hours");
              });
          });
      });
